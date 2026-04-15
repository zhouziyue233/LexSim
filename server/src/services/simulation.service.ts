import type {
  LLMConfig,
  Simulation,
  SimulationStage,
  StageStatus,
} from '@shared/types'
import type { SSEStream } from './sse.js'
import { persistence } from './persistence.service.js'
import { extractEntities, buildRelationshipGraph, summarizeCaseBackground, detectCaseLanguage } from './llm.service.js'
import { generateReportReACT } from './report.service.js'
import { GameMaster } from '../engine/GameMaster.js'
import { calibrateEntityInfluence } from '../engine/influence-calculator.js'

interface SimulationContext {
  simulation: Simulation
  config: LLMConfig
  emitter: SSEStream
  stageStatuses: Record<number, StageStatus>
}

function getEffectiveCaseInput(simulation: Simulation, lang?: 'zh' | 'en'): string {
  const parts: string[] = []
  if (simulation.fileContent) {
    const fileHeader = lang === 'en'
      ? `[Uploaded file: ${simulation.fileName ?? 'unknown'}]`
      : `【上传文件：${simulation.fileName ?? '未知文件'}】`
    parts.push(`${fileHeader}\n${simulation.fileContent}`)
  }
  if (simulation.caseInput.trim()) {
    parts.push(simulation.caseInput.trim())
  }
  return parts.join('\n\n')
}

type StageRunner = (context: SimulationContext) => Promise<void>

const STAGE_LABELS: Record<Exclude<SimulationStage, 0>, string> = {
  1: 'Entity Extraction',
  2: 'Relationship Graph',
  3: 'Multi-Agent Simulation',
  4: 'Report Generation',
}

function markStage(
  context: SimulationContext,
  stage: Exclude<SimulationStage, 0>,
  status: StageStatus,
) {
  context.stageStatuses[stage] = status
  persistence.updateSimulation(context.simulation.id, {
    stage,
    stageStatuses: { ...context.stageStatuses },
  })
}

function startStage(context: SimulationContext, stage: Exclude<SimulationStage, 0>) {
  markStage(context, stage, 'loading')
  context.emitter.emit('stage:start', { stage, label: STAGE_LABELS[stage] })
}

function emitStageChunk(context: SimulationContext, stage: Exclude<SimulationStage, 0>, text: string) {
  context.emitter.emit('stage:chunk', { stage, text })
}

function completeStage(context: SimulationContext, stage: Exclude<SimulationStage, 0>) {
  markStage(context, stage, 'done')
  context.emitter.emit('stage:complete', { stage })
}

const stageRunners: Record<Exclude<SimulationStage, 0>, StageRunner> = {
  async 1(context) {
    if (context.simulation.entities.length > 0) {
      if (context.simulation.caseSummary) {
        context.emitter.emit('case:summary', { summary: context.simulation.caseSummary })
      }
      context.emitter.emit('entity:batch', { entities: context.simulation.entities })
      completeStage(context, 1)
      return
    }

    const effectiveInput = getEffectiveCaseInput(context.simulation, context.config.caseLanguage)

    // Generate case summary from combined input
    if (!context.simulation.caseSummary) {
      const summary = await summarizeCaseBackground(effectiveInput, context.config)
      persistence.saveCaseSummary(context.simulation.id, summary)
      context.simulation.caseSummary = summary
      context.emitter.emit('case:summary', { summary })
    }

    const rawEntities = await extractEntities(
      effectiveInput,
      context.config,
      (chunk) => emitStageChunk(context, 1, chunk),
    )

    // Calibrate social entity influence using weighted algorithm
    const entities = calibrateEntityInfluence(rawEntities)

    persistence.saveEntities(context.simulation.id, entities)
    context.simulation.entities = entities
    context.emitter.emit('entity:batch', { entities })
    completeStage(context, 1)
  },

  async 2(context) {
    if (context.simulation.graph) {
      context.emitter.emit('graph:complete', { graph: context.simulation.graph })
      completeStage(context, 2)
      return
    }

    const graph = await buildRelationshipGraph(
      context.simulation.entities,
      context.config,
      (chunk) => emitStageChunk(context, 2, chunk),
    )

    persistence.saveRelationships(context.simulation.id, graph.edges)
    context.simulation.graph = graph
    context.emitter.emit('graph:complete', { graph })
    completeStage(context, 2)
  },

  async 3(context) {
    if (!context.simulation.graph) {
      throw new Error('Simulation graph is missing')
    }

    const effectiveInput = getEffectiveCaseInput(context.simulation, context.config.caseLanguage)
    const gameMaster = new GameMaster(
      context.simulation.entities,
      context.simulation.graph,
      effectiveInput,
      context.simulation.roundCount,
      context.config,
      context.emitter,
      context.simulation.id,
    )

    const timeline = await gameMaster.run()
    context.simulation.timeline = timeline
    completeStage(context, 3)
  },

  async 4(context) {
    if (!context.simulation.timeline) {
      throw new Error('Simulation timeline is missing')
    }

    const effectiveInput = getEffectiveCaseInput(context.simulation, context.config.caseLanguage)
    const report = await generateReportReACT(
      effectiveInput,
      context.simulation.entities,
      context.simulation.timeline,
      context.config,
      context.emitter,
      context.simulation.graph ?? undefined,
      context.simulation.roundCount,
    )
    persistence.saveReport(context.simulation.id, report)
    context.simulation.report = report
    context.emitter.emit('report:complete', { report })
    completeStage(context, 4)
  },
}

export async function runSimulation(
  simulation: Simulation,
  config: LLMConfig,
  emitter: SSEStream,
) {
  // Detect case language once and inject into every subsequent LLM call via config
  const rawInput = getEffectiveCaseInput(simulation)
  const caseLanguage = detectCaseLanguage(rawInput)
  config = { ...config, caseLanguage }

  const stageStatuses = {
    0: 'idle',
    1: simulation.stageStatuses[1] ?? 'idle',
    2: simulation.stageStatuses[2] ?? 'idle',
    3: simulation.stageStatuses[3] ?? 'idle',
    4: simulation.stageStatuses[4] ?? 'idle',
  } as Record<number, StageStatus>

  const context: SimulationContext = {
    simulation,
    config,
    emitter,
    stageStatuses,
  }

  persistence.updateSimulation(simulation.id, {
    status: 'running',
    error: null,
    stageStatuses: { ...stageStatuses },
  })
  emitter.emit('simulation:started', { simulationId: simulation.id })

  try {
    const startingStage = simulation.stage <= 2 ? 1 : 3

    for (let stage = startingStage as Exclude<SimulationStage, 0>; stage <= 4; stage++) {
      startStage(context, stage)
      await stageRunners[stage](context)
    }

    persistence.updateSimulation(simulation.id, { status: 'completed' })
    emitter.emit('simulation:complete', { simulationId: simulation.id })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const currentStage = ([1, 2, 3, 4] as SimulationStage[])
      .find(stage => stageStatuses[stage] === 'loading')

    if (currentStage) {
      stageStatuses[currentStage] = 'error'
      emitter.emit('stage:error', { stage: currentStage, error: errorMsg })
    }

    persistence.updateSimulation(simulation.id, {
      status: 'failed',
      stage: currentStage ?? simulation.stage,
      stageStatuses: { ...stageStatuses },
      error: errorMsg,
    })
    emitter.emit('error', { error: errorMsg })
  } finally {
    emitter.close()
  }
}
