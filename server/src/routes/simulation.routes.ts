import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import {
  DEFAULT_SIMULATION_ROUNDS,
  MAX_SIMULATION_ROUNDS,
  MIN_SIMULATION_ROUNDS,
} from '@shared/constants'
import { validateBody } from '../middleware/validateBody.js'
import { getLLMConfig } from './config.routes.js'
import { SSEEmitter } from '../services/sse.js'
import type { SSEStream } from '../services/sse.js'
import { runSimulation } from '../services/simulation.service.js'
import { persistence } from '../services/persistence.service.js'

const router = Router()

// Track active SSE connections per simulation
const activeStreams = new Map<string, SSEEmitter[]>()

export const createSimulationSchema = z.object({
  projectName: z.string().optional(),
  caseInput: z.string().default(''),
  roundCount: z.number().int().min(MIN_SIMULATION_ROUNDS).max(MAX_SIMULATION_ROUNDS).default(DEFAULT_SIMULATION_ROUNDS),
  fileContent: z.string().optional(),
  fileName: z.string().optional(),
}).refine(
  (data) => data.caseInput.length >= 20 || (data.fileContent && data.fileContent.length > 0),
  { message: 'Either case input (≥20 chars) or a file must be provided' },
)

function getBroadcastEmitter(simulationId: string): SSEStream {
  return {
    emit(event, data) {
      const emitters = activeStreams.get(simulationId) ?? []
      for (const emitter of emitters) emitter.emit(event, data)
    },
    close() {
      const emitters = activeStreams.get(simulationId) ?? []
      for (const emitter of emitters) emitter.close()
      activeStreams.delete(simulationId)
    },
  }
}

function scheduleSimulationRun(simulationId: string) {
  const simulation = persistence.getSimulation(simulationId)
  if (!simulation) return

  const config = getLLMConfig()
  if (!config.apiKey) {
    throw new Error('请先配置模型 API Key')
  }

  const emitter = getBroadcastEmitter(simulationId)
  setTimeout(() => {
    runSimulation(simulation, config, emitter).catch(err => {
      console.error(`[Simulation ${simulationId}] Fatal error:`, err)
      emitter.emit('error', { error: String(err) })
      emitter.close()
    })
  }, 0)
}

/** POST /api/simulations — Create and start a simulation */
router.post('/', validateBody(createSimulationSchema), (req, res) => {
  const config = getLLMConfig()
  if (!config.apiKey) {
    res.status(400).json({ success: false, error: '请先配置模型 API Key' })
    return
  }

  const simulationId = uuidv4()
  const { projectName, caseInput, roundCount, fileContent, fileName } = req.body as {
    projectName?: string; caseInput: string; roundCount: number; fileContent?: string; fileName?: string
  }

  persistence.createSimulation(simulationId, caseInput, roundCount, fileContent, fileName, projectName)

  res.json({ success: true, data: { simulationId } })
  scheduleSimulationRun(simulationId)
})

/** GET /api/simulations — List all simulations */
router.get('/', (_req, res) => {
  const sims = persistence.listSimulations()
  res.json({ success: true, data: sims })
})

/** GET /api/simulations/:id — Get full simulation state */
router.get('/:id', (req, res) => {
  const sim = persistence.getSimulation(String(req.params.id))
  if (!sim) {
    res.status(404).json({ success: false, error: 'Simulation not found' })
    return
  }
  res.json({ success: true, data: sim })
})

/** GET /api/simulations/:id/stream — SSE event stream */
router.get('/:id/stream', (req, res) => {
  const simId = String(req.params.id)
  const simulation = persistence.getSimulation(simId)
  if (!simulation) {
    res.status(404).json({ success: false, error: 'Simulation not found' })
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const emitter = new SSEEmitter(res)

  if (!activeStreams.has(simId)) {
    activeStreams.set(simId, [])
  }
  activeStreams.get(simId)!.push(emitter)

  req.on('close', () => {
    const list = activeStreams.get(simId)
    if (list) {
      const idx = list.indexOf(emitter)
      if (idx !== -1) list.splice(idx, 1)
      if (list.length === 0) activeStreams.delete(simId)
    }
  })
})

/** POST /api/simulations/:id/resume — Resume a stalled simulation */
router.post('/:id/resume', (req, res) => {
  const simId = String(req.params.id)
  const sim = persistence.getSimulation(simId)
  if (!sim) {
    res.status(404).json({ success: false, error: 'Simulation not found' })
    return
  }
  if (sim.status === 'completed') {
    res.status(400).json({ success: false, error: 'Simulation already completed' })
    return
  }
  const config = getLLMConfig()
  if (!config.apiKey) {
    res.status(400).json({ success: false, error: '请先配置模型 API Key' })
    return
  }
  res.json({ success: true })
  scheduleSimulationRun(simId)
})

/** DELETE /api/simulations/:id — Delete a simulation */
router.delete('/:id', (req, res) => {
  persistence.deleteSimulation(String(req.params.id))
  res.json({ success: true })
})

export default router
