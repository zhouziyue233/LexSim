import type {
  LegalEntity,
  RelationshipGraph,
  RelationEdge,
  GameplayEvent,
  TrialPhase,
  JudgeDirective,
  BurdenOfProofState,
} from '@shared/types'
export class WorldState {
  round = 0
  currentPlaintiffWinProb = 50
  socialInfluenceScore = 0
  events: GameplayEvent[] = []
  currentPhase: TrialPhase = 'OPENING'
  activeDirectives: JudgeDirective[] = []

  // #4 举证责任状态追踪
  burdenOfProof: BurdenOfProofState = {
    currentBearingParty: 'PLAINTIFF',  // 默认由原告承担举证责任
    standardMet: false,
    standardThreshold: 0.51,           // 民事诉讼优势证据标准
  }

  constructor(
    public entities: LegalEntity[],
    public graph: RelationshipGraph,
    public caseInput: string,
  ) {}

  getRecentEvents(lastN = 10): GameplayEvent[] {
    return this.events.slice(-lastN)
  }

  getEntityRelationships(entityId: string): RelationEdge[] {
    return this.graph.edges.filter(e => e.source === entityId || e.target === entityId)
  }

  addEvent(event: GameplayEvent) {
    this.events.push(event)

    // 位置阻力：概率越远离 50%，同方向推动越困难（加强以防止极端值累积）
    const rawShift = event.probabilityShift ?? 0
    const distFromCenter = Math.abs(this.currentPlaintiffWinProb - 50)
    const resistance = Math.max(0.15, 1 - 0.014 * distFromCenter)
    const effectiveShift = rawShift * resistance

    this.currentPlaintiffWinProb = Math.round(Math.max(0, Math.min(100,
      this.currentPlaintiffWinProb + effectiveShift)))
    this.socialInfluenceScore = Math.max(-100, Math.min(100,
      this.socialInfluenceScore + (event.publicSentimentDelta ?? 0)))
  }

  setEvents(events: GameplayEvent[]) {
    this.events = [...events]
  }

  /**
   * 每轮结束后施加均值回归拉力 + 微弱舆论余压。
   * 均值回归：模拟司法不确定性，防止概率单向漂移（偏离50%越远，回拉越强）。
   * 舆论余压系数大幅降低，避免 socialInfluenceScore 累积偏向。
   */
  applySentimentPressure() {
    const meanReversionPull = (50 - this.currentPlaintiffWinProb) * 0.04
    const sentimentShift = this.socialInfluenceScore * 0.002
    this.currentPlaintiffWinProb = Math.max(0, Math.min(100,
      this.currentPlaintiffWinProb + meanReversionPull + sentimentShift))
  }

  // ─── Directive Management ──────────────────────────────────────────────

  addDirective(d: JudgeDirective) {
    this.activeDirectives.push(d)
  }

  pruneExpiredDirectives(currentRound: number) {
    this.activeDirectives = this.activeDirectives.filter(
      d => d.expiresRound >= currentRound,
    )
  }

  // ─── Burden of Proof Management (#4) ─────────────────────────────────

  /**
   * 根据证据累积情况，动态评估并更新举证责任状态。
   * 当原告方累积证据影响超过阈值时，举证责任转移至被告方。
   */
  updateBurdenOfProof() {
    const plaintiffRoles = ['PLAINTIFF', 'PLAINTIFF_LAWYER']
    const defendantRoles = ['DEFENDANT', 'DEFENDANT_LAWYER']

    const pShift = this.events
      .filter(e => {
        const a = this.entities.find(ent => ent.id === e.actorId)
        return a && plaintiffRoles.includes(a.role) &&
          (e.type === 'EVIDENCE_SUBMISSION' || e.type === 'WITNESS_TESTIMONY')
      })
      .reduce((s, e) => s + Math.abs(e.probabilityShift) * (e.evidenceWeightMultiplier ?? 1), 0)

    const dShift = this.events
      .filter(e => {
        const a = this.entities.find(ent => ent.id === e.actorId)
        return a && defendantRoles.includes(a.role) &&
          (e.type === 'EVIDENCE_SUBMISSION' || e.type === 'WITNESS_TESTIMONY')
      })
      .reduce((s, e) => s + Math.abs(e.probabilityShift) * (e.evidenceWeightMultiplier ?? 1), 0)

    // 原告证据充分（累积影响 > 15 且超过被告 1.5 倍）→ 举证责任转移至被告
    const prevParty = this.burdenOfProof.currentBearingParty
    if (pShift > 15 && pShift > dShift * 1.5) {
      this.burdenOfProof.currentBearingParty = 'DEFENDANT'
      this.burdenOfProof.standardMet = pShift >= this.burdenOfProof.standardThreshold * 30
      if (prevParty !== 'DEFENDANT') {
        this.burdenOfProof.lastShiftRound = this.round
        this.burdenOfProof.reason = '原告已提交充分证据，举证责任转由被告反驳'
      }
    } else if (dShift > 15 && dShift > pShift * 1.5) {
      this.burdenOfProof.currentBearingParty = 'PLAINTIFF'
      this.burdenOfProof.standardMet = false
      if (prevParty !== 'PLAINTIFF') {
        this.burdenOfProof.lastShiftRound = this.round
        this.burdenOfProof.reason = '被告提出有力反驳，原告需进一步举证'
      }
    } else {
      this.burdenOfProof.currentBearingParty = 'SHARED'
      this.burdenOfProof.standardMet = false
    }
  }

  getBurdenText(): string {
    const { currentBearingParty, standardMet, lastShiftRound, reason } = this.burdenOfProof
    const partyMap: Record<string, string> = { PLAINTIFF: '原告', DEFENDANT: '被告', SHARED: '双方共同' }
    let text = `举证责任由【${partyMap[currentBearingParty]}】承担`
    if (standardMet) text += '（已基本完成举证）'
    if (lastShiftRound) text += `；第${lastShiftRound}轮发生责任转移：${reason ?? ''}`
    return text
  }

  // ─── Situation Awareness ─────────────────────────────────────────────

  getTurningPoints(topN = 3): string {
    if (this.events.length === 0) return '（尚无事件）'
    const sorted = [...this.events]
      .sort((a, b) => Math.abs(b.probabilityShift) - Math.abs(a.probabilityShift))
      .slice(0, topN)
    return sorted.map(ev => {
      const actor = this.entities.find(e => e.id === ev.actorId)?.name ?? ev.actorId
      const sign = ev.probabilityShift > 0 ? '+' : ''
      return `[轮${ev.round}] ${actor}: ${ev.description.slice(0, 50)}（${sign}${ev.probabilityShift}%）`
    }).join('\n')
  }

  getMomentumDescription(): string {
    const recent = this.events.slice(-5)
    if (recent.length < 2) return '局势尚不明朗'
    const shifts = recent.map(e => e.probabilityShift)
    const positiveCount = shifts.filter(s => s > 0).length
    const negativeCount = shifts.filter(s => s < 0).length
    if (positiveCount >= 4) return '原告方连续取得优势，势头强劲'
    if (negativeCount >= 4) return '被告方连续取得优势，势头强劲'
    if (positiveCount >= 3) return '原告方近期占据主动'
    if (negativeCount >= 3) return '被告方近期占据主动'
    return '局势胶着，双方互有攻守'
  }

  // ─── Summary & Snapshot ──────────────────────────────────────────────

  toSummaryText(): string {
    const recentEvents = this.getRecentEvents(5)
    const eventSummary = recentEvents.map(ev => {
      const actor = this.entities.find(e => e.id === ev.actorId)?.name ?? ev.actorId
      return `[轮${ev.round}] ${actor}: ${ev.description.slice(0, 60)}`
    }).join('\n')

    const PHASE_NAMES: Record<TrialPhase, string> = {
      OPENING: '开庭陈述', EVIDENCE: '举证质证', DEBATE: '法庭辩论', CLOSING: '最后陈述/宣判',
    }
    return `当前轮次：${this.round}
当前阶段：${PHASE_NAMES[this.currentPhase]}
原告胜诉概率：${this.currentPlaintiffWinProb}%
社会影响指数：${this.socialInfluenceScore}
最近事件：
${eventSummary || '（无）'}`
  }

}
