import pLimit from 'p-limit'
import type {
  LegalEntity,
  RelationshipGraph,
  LLMConfig,
  GameplayTimeline,
} from '@shared/types'
import type { SSEStream } from '../services/sse.js'
import { persistence } from '../services/persistence.service.js'
import { config as serverConfig } from '../config.js'
import { Agent } from './Agent.js'
import { JudgeAgent } from './JudgeAgent.js'
import { LitigantAgent } from './LitigantAgent.js'
import { WorldState } from './WorldState.js'
import { resolveActions } from './action-resolver.js'
import { updateRelationships } from './relationship-updater.js'
import { getTrialPhase } from './trial-phase.js'

const LITIGANT_ROLES = new Set(['PLAINTIFF', 'DEFENDANT', 'PLAINTIFF_LAWYER', 'DEFENDANT_LAWYER'])

export class GameMaster {
  private agents: Map<string, Agent> = new Map()
  private worldState: WorldState
  private emitter: SSEStream
  private simulationId: string
  private config: LLMConfig
  private totalRounds: number

  constructor(
    entities: LegalEntity[],
    graph: RelationshipGraph,
    caseInput: string,
    totalRounds: number,
    config: LLMConfig,
    emitter: SSEStream,
    simulationId: string,
  ) {
    this.worldState = new WorldState(entities, graph, caseInput)
    this.config = config
    this.emitter = emitter
    this.simulationId = simulationId
    this.totalRounds = totalRounds

    // Create specialized Agent per entity based on role
    for (const entity of entities) {
      if (entity.role === 'JUDGE') {
        this.agents.set(entity.id, new JudgeAgent(entity, config))
      } else if (LITIGANT_ROLES.has(entity.role)) {
        this.agents.set(entity.id, new LitigantAgent(entity, config))
      } else {
        this.agents.set(entity.id, new Agent(entity, config))
      }
    }
  }

  async run(): Promise<GameplayTimeline> {
    const startRound = this.worldState.round + 1
    console.log(`[GameMaster] Starting simulation: rounds ${startRound}→${this.totalRounds} (total=${this.totalRounds})`)

    for (let round = startRound; round <= this.totalRounds; round++) {
      this.worldState.round = round
      console.log(`[GameMaster] Running round ${round}/${this.totalRounds}`)
      await this.runRound(round)

      // Apply public sentiment pressure to probability after each round
      this.worldState.applySentimentPressure()

      // #4 更新举证责任状态（每轮重新评估证据积累情况）
      this.worldState.updateBurdenOfProof()
    }

    return {
      events: this.worldState.events,
      currentPlaintiffWinProb: this.worldState.currentPlaintiffWinProb,
      socialInfluenceScore: this.worldState.socialInfluenceScore,
    }
  }

  private async runRound(round: number) {
    // Set trial phase and prune expired directives
    const phase = getTrialPhase(round, this.totalRounds)
    this.worldState.currentPhase = phase
    this.worldState.pruneExpiredDirectives(round)

    const activeAgents = this.selectActiveAgents(round)

    this.emitter.emit('round:start', {
      round,
      phase,
      activeAgents: activeAgents.map(a => a.entityId),
      activeDirectives: this.worldState.activeDirectives,
    })

    // Parallel agent decision-making with concurrency limit
    const limit = pLimit(serverConfig.maxConcurrency)

    const actions = await Promise.all(
      activeAgents.map(agent =>
        limit(async () => {
          this.emitter.emit('agent:thinking', {
            agentId: agent.entityId,
            agentName: agent.entity.name,
          })

          const action = await agent.decide(this.worldState)

          this.emitter.emit('agent:action', {
            agentId: agent.entityId,
            agentName: agent.entity.name,
            action,
          })

          return action
        }),
      ),
    )

    // Resolve actions into gameplay events
    const events = resolveActions(
      actions,
      this.worldState.entities,
      this.worldState.events,
      round,
    )

    // Extract judge directives from actions
    for (const action of actions) {
      if (action.directive) {
        const entity = this.worldState.entities.find(e => e.id === action.agentId)
        if (entity?.role === 'JUDGE') {
          this.worldState.addDirective({
            id: `dir-${round}-${action.agentId}`,
            round,
            directiveType: action.directive.directiveType,
            targetAgentId: action.directive.targetAgentId,
            description: action.directive.description,
            expiresRound: round + (action.directive.duration ?? 2),
          })
        }
      }
    }

    // Apply events to world state and emit them
    let eventSequence = 0
    for (const event of events) {
      this.worldState.addEvent(event)
      persistence.saveEvent(this.simulationId, event, eventSequence++)

      this.emitter.emit('event:resolved', {
        event,
        newProb: this.worldState.currentPlaintiffWinProb,
        newSentiment: this.worldState.socialInfluenceScore,
      })
    }

    // Update relationship graph based on round events
    const edgeChanges = updateRelationships(
      this.worldState.graph.edges,
      events,
      this.worldState.activeDirectives,
      this.worldState.entities,
      round,
    )
    this.worldState.applyEdgeChanges(edgeChanges)
    if (edgeChanges.length > 0) {
      this.emitter.emit('graph:update', { round, changes: edgeChanges })
    }

    // Build round summary
    const roundSummary = `第${round}轮：${events.length}个事件，胜诉概率${this.worldState.currentPlaintiffWinProb}%，社会影响指数${this.worldState.socialInfluenceScore}`

    // Update all agents' memory (including inactive ones, they observe)
    for (const [, agent] of this.agents) {
      agent.updateMemory(events, roundSummary)
    }

    this.emitter.emit('round:complete', {
      round,
      prob: this.worldState.currentPlaintiffWinProb,
      sentiment: this.worldState.socialInfluenceScore,
      eventCount: events.length,
    })
  }

  /**
   * 按审判阶段选择本轮活跃 Agent。
   * OPENING:  原被告 + 律师（建立初始立场）
   * EVIDENCE: 全部法庭方 + 按影响力排序的社会方
   * DEBATE:   全部参与
   * CLOSING:  法官 + 律师 + 全部社会方
   */
  private selectActiveAgents(_round: number): Agent[] {
    const courtAgents = [...this.agents.values()].filter(a => a.entity.category === 'COURT')
    const socialAgents = [...this.agents.values()].filter(a => a.entity.category === 'SOCIAL')
    const phase = this.worldState.currentPhase

    switch (phase) {
      case 'OPENING': {
        // 开庭陈述：只有原被告和律师
        return courtAgents.filter(a =>
          a.entity.role !== 'JUDGE' && a.entity.role !== 'WITNESS')
      }
      case 'EVIDENCE': {
        // 举证质证：全部法庭方 + 按影响力排序的前几名社会方
        const topSocial = socialAgents
          .sort((a, b) => (b.entity.caseInfluence ?? 0) - (a.entity.caseInfluence ?? 0))
          .slice(0, Math.max(2, Math.floor(socialAgents.length * 0.6)))
        return [...courtAgents, ...topSocial]
      }
      case 'DEBATE': {
        // 法庭辩论：全部参与
        return [...this.agents.values()]
      }
      case 'CLOSING': {
        // 宣判：法官 + 律师 + 全部社会方
        const judge = courtAgents.find(a => a.entity.role === 'JUDGE')
        const lawyers = courtAgents.filter(a =>
          a.entity.role === 'PLAINTIFF_LAWYER' || a.entity.role === 'DEFENDANT_LAWYER')
        return [...(judge ? [judge] : []), ...lawyers, ...socialAgents]
      }
    }
  }
}
