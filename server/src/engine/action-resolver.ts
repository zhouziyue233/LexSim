import type {
  AgentAction,
  GameplayEvent,
  LegalEntity,
  ProceedingType,
  EvidenceCategory,
} from '@shared/types'
import { IN_COURT_TYPES, EVIDENCE_CATEGORY_WEIGHTS } from '@shared/constants'

/**
 * 根据行动描述文本推断证据类型（#3 证据效力分级）。
 * 仅适用于 EVIDENCE_SUBMISSION 和 WITNESS_TESTIMONY 行动。
 */
function inferEvidenceCategory(action: AgentAction): EvidenceCategory | undefined {
  if (action.actionType !== 'EVIDENCE_SUBMISSION' && action.actionType !== 'WITNESS_TESTIMONY') {
    return undefined
  }
  if (action.actionType === 'WITNESS_TESTIMONY') return 'WITNESS'

  const text = (action.description + ' ' + action.reasoning).toLowerCase()
  if (text.includes('鉴定') || text.includes('专家') || text.includes('检验报告') || text.includes('司法鉴定')) {
    return 'EXPERT'
  }
  if (text.includes('合同') || text.includes('录音') || text.includes('录像') || text.includes('视频') ||
      text.includes('书证') || text.includes('电子') || text.includes('转账') || text.includes('收据') ||
      text.includes('协议') || text.includes('票据') || text.includes('聊天记录')) {
    return 'DIRECT'
  }
  if (text.includes('间接') || text.includes('情况') || text.includes('推断') || text.includes('旁证')) {
    return 'CIRCUMSTANTIAL'
  }
  if (text.includes('听说') || text.includes('据称') || text.includes('转述') || text.includes('传言')) {
    return 'HEARSAY'
  }
  // 默认：一般书面证据视为直接证据
  return 'DIRECT'
}

/** Base weight for each proceeding type */
const BASE_WEIGHTS: Record<ProceedingType, number> = {
  EVIDENCE_SUBMISSION: 6,
  CROSS_EXAMINATION: 5,
  ORAL_ARGUMENT: 4,
  SETTLEMENT_OFFER: 3,
  JUDICIAL_RULING: 10,
  WITNESS_TESTIMONY: 4,
  MEDIA_REPORT: 8,
  SOCIAL_POST: 5,
  LEGISLATIVE_MOTION: 7,
  GOVT_STATEMENT: 6,
  PUBLIC_PROTEST: 4,
  EXPERT_OPINION: 5,
}

/**
 * 预测权重分配：
 *   法庭内博弈   60%  → COURT_PROB_SCALE = 0.60
 *   法庭外博弈   40%
 *     政府/领导  20%  → GOVT_STATEMENT, LEGISLATIVE_MOTION
 *     权威媒体   10%  → MEDIA_REPORT
 *     社会影响方 10%  → SOCIAL_POST, PUBLIC_PROTEST, EXPERT_OPINION
 *
 * 每类事件均直接贡献 probabilityShift = intensity × baseWeight × scale × diminishFactor
 * publicSentimentDelta 仍保留，供社会情绪指数（socialInfluenceScore）显示用。
 */
const COURT_PROB_SCALE = 0.60

const OUT_COURT_PROB_SCALE: Partial<Record<ProceedingType, number>> = {
  // 政府单位/领导影响力 → 20%
  GOVT_STATEMENT:     0.20,
  LEGISLATIVE_MOTION: 0.20,
  // 权威媒体机构 → 10%
  MEDIA_REPORT:       0.10,
  // 社会影响方 → 10%
  SOCIAL_POST:        0.10,
  PUBLIC_PROTEST:     0.10,
  EXPERT_OPINION:     0.10,
}

// ─── Target-Aware Impact Modifiers ──────────────────────────────────────────
const TARGET_MOD_CROSS_EXAM_WEAK = 1.3
const TARGET_MOD_CROSS_EXAM_STRONG = 0.8
const TARGET_MOD_JUDICIAL_TARGETED = 1.2
const TARGET_MOD_SOCIAL_TO_COURT = 1.15
const TARGET_MOD_SOCIAL_TO_SOCIAL = 0.85
const TARGET_MOD_SETTLEMENT_DIRECT = 1.1

function computeTargetModifier(
  action: AgentAction,
  target: LegalEntity,
  _actor: LegalEntity,
  previousEvents: GameplayEvent[],
): number {
  // Cross-examination: weak vs strong witness
  if (action.actionType === 'CROSS_EXAMINATION' && target.role === 'WITNESS') {
    const witnessEvents = previousEvents.filter(e => e.actorId === target.id)
    const isStrong = witnessEvents.length >= 3 || (target.caseInfluence ?? 50) >= 70
    return isStrong ? TARGET_MOD_CROSS_EXAM_STRONG : TARGET_MOD_CROSS_EXAM_WEAK
  }

  // Judicial ruling targeting specific entity
  if (action.actionType === 'JUDICIAL_RULING') {
    return TARGET_MOD_JUDICIAL_TARGETED
  }

  // Social actor targeting court entity vs other social
  if (target.category === 'COURT') return TARGET_MOD_SOCIAL_TO_COURT
  if (target.category === 'SOCIAL') return TARGET_MOD_SOCIAL_TO_SOCIAL

  // Settlement offer directly targeting opposing party
  if (action.actionType === 'SETTLEMENT_OFFER') {
    return TARGET_MOD_SETTLEMENT_DIRECT
  }

  return 1.0
}

/** Determine if action is pro-plaintiff, pro-defendant, or neutral based on entity role */
function determineImpact(entity: LegalEntity, action: AgentAction): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  const role = entity.role

  // Plaintiff side → positive
  if (role === 'PLAINTIFF' || role === 'PLAINTIFF_LAWYER') return 'POSITIVE'
  // Defendant side → negative
  if (role === 'DEFENDANT' || role === 'DEFENDANT_LAWYER') return 'NEGATIVE'

  // Judge → always neutral; influence is through directives, not probability shifts
  if (role === 'JUDGE') return 'NEUTRAL'

  if (entity.supportsPlaintiff === true) return 'POSITIVE'
  if (entity.supportsPlaintiff === false) return 'NEGATIVE'

  // 无明确立场的社会主体：真正中立，不影响胜诉概率方向
  return 'NEUTRAL'
}

/**
 * Resolve raw agent actions into scored gameplay events.
 */
export function resolveActions(
  actions: AgentAction[],
  entities: LegalEntity[],
  previousEvents: GameplayEvent[],
  round: number,
): GameplayEvent[] {
  const events: GameplayEvent[] = []
  let eventCounter = previousEvents.length

  // Count repeated action types from last round for diminishing returns
  const lastRoundEvents = previousEvents.filter(e => e.round === round - 1)
  const lastRoundTypes = new Set(lastRoundEvents.map(e => e.type))

  // 动量效应：检查最近 3 个事件的概率偏移方向
  const recentShifts = previousEvents.slice(-3).map(e => e.probabilityShift).filter(s => s !== 0)
  const allPositive = recentShifts.length >= 3 && recentShifts.every(s => s > 0)
  const allNegative = recentShifts.length >= 3 && recentShifts.every(s => s < 0)
  const momentumDir = allPositive ? 1 : allNegative ? -1 : 0

  for (const action of actions) {
    const entity = entities.find(e => e.id === action.agentId)
    if (!entity) continue

    eventCounter++
    const baseWeight = BASE_WEIGHTS[action.actionType] ?? 4
    const isCourtAction = IN_COURT_TYPES.has(action.actionType)

    // Diminishing returns: -30% if same action type appeared last round
    const diminishFactor = lastRoundTypes.has(action.actionType) ? 0.7 : 1.0

    let probabilityShift = 0
    let publicSentimentDelta = 0

    // #3 证据效力分级：推断证据类型并应用效力倍数
    const evidenceCategory = inferEvidenceCategory(action)
    const evidenceWeightMultiplier = evidenceCategory
      ? (EVIDENCE_CATEGORY_WEIGHTS[evidenceCategory] ?? 1.0)
      : 1.0

    if (isCourtAction) {
      // 法庭内博弈：直接驱动胜诉概率，权重 60%，乘以证据效力倍数
      const rawShift = action.intensity * baseWeight * COURT_PROB_SCALE * diminishFactor * evidenceWeightMultiplier
      probabilityShift = Math.round(rawShift * 10) / 10
    } else {
      // 法庭外博弈：按子分类权重（政府20%/媒体10%/社会10%）直接驱动概率
      const probScale = OUT_COURT_PROB_SCALE[action.actionType] ?? 0.10
      const rawShift = action.intensity * baseWeight * probScale * diminishFactor
      probabilityShift = Math.round(rawShift * 10) / 10

      // 同时更新社会情绪指数（仅用于显示/归档，不再作为主要概率驱动）
      const influence = entity.caseInfluence ?? 50
      const rawDelta = action.intensity * baseWeight * (influence / 100) * diminishFactor
      publicSentimentDelta = Math.round(rawDelta * 10) / 10
    }

    const impact = determineImpact(entity, action)

    // Negative impact flips the sign; neutral zeroes out probability shift
    if (impact === 'NEGATIVE') {
      probabilityShift = -Math.abs(probabilityShift)
      publicSentimentDelta = -Math.abs(publicSentimentDelta)
    } else if (impact === 'POSITIVE') {
      probabilityShift = Math.abs(probabilityShift)
      publicSentimentDelta = Math.abs(publicSentimentDelta)
    } else {
      // NEUTRAL: 真正中立，不推动胜诉概率方向，避免默认偏向原告
      probabilityShift = 0
      publicSentimentDelta = 0
    }

    // Apply target modifier
    if (action.targetId) {
      const target = entities.find(e => e.id === action.targetId)
      if (target) {
        probabilityShift *= computeTargetModifier(action, target, entity, previousEvents)
      }
    }

    // 动量效应：连续同方向事件产生 5% 微加速（降低雪球效应）
    if (momentumDir !== 0 && Math.sign(probabilityShift) === momentumDir) {
      probabilityShift *= 1.05
    }

    // Clamp shifts
    probabilityShift = Math.max(-20, Math.min(20, probabilityShift))
    publicSentimentDelta = Math.max(-15, Math.min(15, publicSentimentDelta))

    const event: GameplayEvent = {
      id: `ev${eventCounter}`,
      round,
      timestamp: `第${round}轮`,
      type: action.actionType,
      actorId: action.agentId,
      targetId: action.targetId,
      description: action.description,
      impact,
      probabilityShift: Math.round(probabilityShift),
      publicSentimentDelta: Math.round(publicSentimentDelta),
      ...(evidenceCategory ? { evidenceCategory, evidenceWeightMultiplier } : {}),
    }

    events.push(event)
  }

  return events
}
