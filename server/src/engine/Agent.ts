import type {
  LegalEntity,
  LLMConfig,
  AgentAction,
  AgentMemory,
  ProceedingType,
  GameplayEvent,
  DirectiveType,
} from '@shared/types'
import { ROLE_ALLOWED_ACTIONS } from '@shared/constants'
import { chatJSON } from '../services/llm.service.js'
import { getPhaseGuidance, getPhaseLabelMap, PHASE_LABELS } from './trial-phase.js'
import type { WorldState } from './WorldState.js'

/** Returns a language instruction appended to system prompts when the case is in English. */
function langInstruction(config: LLMConfig): string {
  return config.caseLanguage === 'en'
    ? '\n\nIMPORTANT: The case materials are in English. You MUST respond entirely in English. All reasoning, descriptions, entity names, and analysis must be written in English.'
    : ''
}

export class Agent {
  readonly entityId: string
  readonly entity: LegalEntity
  memory: AgentMemory
  protected config: LLMConfig

  constructor(entity: LegalEntity, config: LLMConfig) {
    this.entityId = entity.id
    this.entity = entity
    this.config = config
    this.memory = {
      observations: [],
      ownActions: [],
      roundSummaries: [],
      compressedHistory: '',
    }
  }

  async decide(worldState: WorldState): Promise<AgentAction> {
    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildDecisionPrompt(worldState)

    const lang = this.config.caseLanguage ?? 'zh'

    try {
      const result = await chatJSON<{
        actionType: ProceedingType
        targetId?: string
        reasoning: string
        description: string
        intensity: number
        directive?: {
          directiveType: DirectiveType
          targetAgentId?: string
          description: string
          duration?: number
        }
      }>(systemPrompt, userPrompt, this.config)

      // Validate action type is allowed for this role
      const allowed = ROLE_ALLOWED_ACTIONS[this.entity.role] ?? []
      if (!allowed.includes(result.actionType)) {
        result.actionType = allowed[0]
      }

      const action: AgentAction = {
        agentId: this.entityId,
        round: worldState.round,
        actionType: result.actionType,
        targetId: result.targetId,
        reasoning: result.reasoning,
        description: result.description,
        intensity: Math.max(0, Math.min(1, result.intensity ?? 0.5)),
      }

      // Only judges can issue directives
      if (this.entity.role === 'JUDGE' && result.directive) {
        action.directive = result.directive
      }

      return action
    } catch (err) {
      // Fallback: return a default action
      const allowed = ROLE_ALLOWED_ACTIONS[this.entity.role] ?? []
      const fallbackDesc = lang === 'en'
        ? `${this.entity.name} holds back and takes no action this round.`
        : `${this.entity.name} 保持观望，暂未采取行动。`
      return {
        agentId: this.entityId,
        round: worldState.round,
        actionType: allowed[0],
        reasoning: `[Agent error: ${err instanceof Error ? err.message : String(err)}]`,
        description: fallbackDesc,
        intensity: 0.1,
      }
    }
  }

  updateMemory(roundEvents: GameplayEvent[], roundSummary: string) {
    const lang = this.config.caseLanguage ?? 'zh'
    // Observe all events from this round (mark targeted events)
    for (const ev of roundEvents) {
      const actor = ev.actorId === this.entityId
        ? (lang === 'en' ? 'me' : '我')
        : ev.actorId
      const targeted = ev.targetId === this.entityId
        ? (lang === 'en' ? '[targeting you] ' : '[针对你] ')
        : ''
      const roundLabel = lang === 'en' ? `[R${ev.round}]` : `[轮${ev.round}]`
      this.memory.observations.push(
        `${roundLabel} ${targeted}${actor}: ${ev.description.slice(0, 80)}`,
      )
    }

    // Track own actions
    const ownEvent = roundEvents.find(ev => ev.actorId === this.entityId)
    if (ownEvent) {
      this.memory.ownActions.push({
        agentId: this.entityId,
        round: ownEvent.round,
        actionType: ownEvent.type,
        description: ownEvent.description,
        reasoning: '',
        intensity: 0.5,
      })
    }

    this.memory.roundSummaries.push(roundSummary)

    // Sliding window: keep last 5 rounds of summaries, compress older ones
    if (this.memory.roundSummaries.length > 5) {
      const overflow = this.memory.roundSummaries.splice(0, this.memory.roundSummaries.length - 5)
      this.memory.compressedHistory += overflow.join(lang === 'en' ? '; ' : '；')
      // Cap compressed history at 500 chars to avoid token overflow
      if (this.memory.compressedHistory.length > 500) {
        this.memory.compressedHistory = this.memory.compressedHistory.slice(-500)
      }
    }

    // Keep last 20 observations (expanded from 15 to match 5-round window)
    if (this.memory.observations.length > 20) {
      this.memory.observations = this.memory.observations.slice(-20)
    }
  }

  protected buildSystemPrompt(): string {
    const allowed = ROLE_ALLOWED_ACTIONS[this.entity.role] ?? []
    const lang = this.config.caseLanguage ?? 'zh'

    if (lang === 'en') {
      return `You are ${this.entity.name}, playing the role of "${this.entity.role}" in a legal case.

Your position: ${this.entity.position}
Your overall inclination: ${this.entity.supportsPlaintiff === undefined ? 'Neutral / undecided' : this.entity.supportsPlaintiff ? 'Leans toward plaintiff' : 'Leans toward defendant'}
Your interests: ${this.entity.interests.join(', ')}
Your action strategy: ${this.entity.strategy}
Persona: ${this.entity.agentPersona}

${this.entity.category === 'SOCIAL'
  ? `Your case influence score: ${this.entity.caseInfluence ?? 50}/100`
  : ''
}

You may only perform the following action types: ${allowed.join(', ')}

Each round, observe the current situation, review your memory, reason, then decide on one action.
Output strict JSON only (no other text):
{
  "actionType": "action type enum value",
  "targetId": "target entity id (optional — omit if none)",
  "reasoning": "your internal reasoning process (2-3 sentences)",
  "description": "your action description (2-3 sentences, third person)",
  "intensity": 0.7
}
Note: intensity is a 0-1 action strength. 0.1 = mild/cautious, 0.9 = aggressive/assertive.${langInstruction(this.config)}`
    }

    return `你是 ${this.entity.name}，在一起法律案件中担任"${this.entity.role}"角色。

你的立场：${this.entity.position}
你的整体倾向：${this.entity.supportsPlaintiff === undefined ? '中立/待定' : this.entity.supportsPlaintiff ? '更支持原告' : '更支持被告'}
你的利益诉求：${this.entity.interests.join('、')}
你的行动策略：${this.entity.strategy}
人格设定：${this.entity.agentPersona}

${this.entity.category === 'SOCIAL'
  ? `你的案件影响力：${this.entity.caseInfluence ?? 50}/100`
  : ''
}

你只能执行以下行动类型：${allowed.join(', ')}

每轮你观察当前局势、回顾记忆，进行推理，然后决定一个行动。
输出严格 JSON（不要有其他文字）：
{
  "actionType": "行动类型枚举值",
  "targetId": "目标实体id（可选，无则省略）",
  "reasoning": "你的内心推理过程（2-3句）",
  "description": "你的行动描述（2-3句，第三人称）",
  "intensity": 0.7
}
注意：intensity 为 0-1 的行动强度，0.1=温和保守，0.9=激进强硬。`
  }

  protected buildPhaseSection(worldState: WorldState): string {
    const phase = worldState.currentPhase
    const lang = this.config.caseLanguage ?? 'zh'
    const guidance = getPhaseGuidance(phase, this.entity.role, lang)
    const phaseLabels = getPhaseLabelMap(lang)

    if (lang === 'en') {
      return `═══ TRIAL PHASE ═══
Current Phase: ${phaseLabels[phase]} (Round ${worldState.round})
Phase Guidance: ${guidance}

Key Turning Points:
${worldState.getTurningPoints(3)}
Current Momentum: ${worldState.getMomentumDescription()}
═══════════════════`
    }

    return `═══ 审判阶段 ═══
当前阶段：${phaseLabels[phase]}（第 ${worldState.round} 轮）
阶段指引：${guidance}

关键转折：
${worldState.getTurningPoints(3)}
当前势头：${worldState.getMomentumDescription()}
═══════════════`
  }

  protected buildDirectiveSection(worldState: WorldState): string {
    const allDirectives = worldState.activeDirectives
    if (allDirectives.length === 0) return ''
    const lang = this.config.caseLanguage ?? 'zh'
    const lines = allDirectives.map(d => {
      const isTargeted = d.targetAgentId === this.entityId
      if (lang === 'en') {
        const prefix = isTargeted ? '⚠️ [Directed at you — respond with priority] ' : ''
        return `${prefix}[Issued R${d.round}] ${d.description} (valid through Round ${d.expiresRound})`
      }
      const prefix = isTargeted ? '⚠️ [针对你，请优先响应] ' : ''
      return `${prefix}[轮${d.round}发布] ${d.description}（有效至第${d.expiresRound}轮）`
    })
    if (lang === 'en') {
      return `\n═══ JUDGE DIRECTIVES ═══\n${lines.join('\n')}\n═══════════════════`
    }
    return `\n═══ 法官指令 ═══\n${lines.join('\n')}\n═══════════════`
  }

  protected buildSocialFeedback(worldState: WorldState): string {
    if (this.entity.category !== 'SOCIAL') return ''
    const ownEvents = worldState.events.filter(e => e.actorId === this.entityId)
    if (ownEvents.length === 0) return ''
    const lastEvent = ownEvents[ownEvents.length - 1]
    const delta = lastEvent.publicSentimentDelta ?? 0
    const lang = this.config.caseLanguage ?? 'zh'
    if (lang === 'en') {
      return `\nYour last statement shifted the public sentiment index by ${delta > 0 ? '+' : ''}${delta}. Current social influence score: ${worldState.socialInfluenceScore}.`
    }
    return `\n你上轮发声使社会影响指数变化了 ${delta > 0 ? '+' : ''}${delta}。当前社会影响指数为 ${worldState.socialInfluenceScore}。`
  }

  protected buildDecisionPrompt(worldState: WorldState): string {
    const lang = this.config.caseLanguage ?? 'zh'
    const rels = worldState.getEntityRelationships(this.entityId)
    const relText = rels.map(r => {
      const other = r.source === this.entityId ? r.target : r.source
      const otherName = worldState.entities.find(e => e.id === other)?.name ?? other
      if (lang === 'en') {
        return `With ${otherName}: ${r.label} (${r.adversarial ? 'adversarial' : 'cooperative'}, strength ${r.strength})`
      }
      return `与 ${otherName}: ${r.label}（${r.adversarial ? '对抗' : '协作'}，强度${r.strength}）`
    }).join('\n')

    const memoryText = this.memory.observations.length > 0
      ? this.memory.observations.slice(-8).join('\n')
      : (lang === 'en' ? '(This is Round 1 — no history yet)' : '（本轮是第一轮，尚无历史事件）')

    const historySection = this.memory.compressedHistory
      ? (lang === 'en'
          ? `\nEarly game recap:\n${this.memory.compressedHistory}\n`
          : `\n早期博弈回顾：\n${this.memory.compressedHistory}\n`)
      : ''

    const ownActionsText = this.memory.ownActions.slice(-3).map(a => {
      const roundLabel = lang === 'en' ? `[R${a.round}]` : `[轮${a.round}]`
      return `${roundLabel} ${a.description}`
    }).join('\n') || (lang === 'en' ? '(No actions yet)' : '（尚无行动）')

    if (lang === 'en') {
      return `Current situation:
${worldState.toSummaryText()}

${this.buildPhaseSection(worldState)}

Your relationship network:
${relText || '(No direct relationships)'}
${this.buildDirectiveSection(worldState)}${this.buildSocialFeedback(worldState)}
${historySection}
Your memory (recent observations):
${memoryText}

Your previous actions:
${ownActionsText}

This is Round ${worldState.round}. Based on the current situation, decide your action:`
    }

    return `当前局势：
${worldState.toSummaryText()}

${this.buildPhaseSection(worldState)}

你的关系网络：
${relText || '（无直接关系）'}
${this.buildDirectiveSection(worldState)}${this.buildSocialFeedback(worldState)}
${historySection}
你的记忆（近期观察）：
${memoryText}

你之前的行动：
${ownActionsText}

现在是第 ${worldState.round} 轮。请根据当前局势做出你的行动决策：`
  }

  getMemory(): AgentMemory {
    return { ...this.memory }
  }

  setMemory(memory: AgentMemory) {
    this.memory = { ...memory }
  }
}
