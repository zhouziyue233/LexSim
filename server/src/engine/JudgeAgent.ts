import type { LegalEntity, LLMConfig } from '@shared/types'
import { ROLE_ALLOWED_ACTIONS, IN_COURT_TYPES, getRelevantStatutes, EVIDENCE_CATEGORY_LABELS } from '@shared/constants'
import { getPhaseAllowedActions } from './trial-phase.js'
import { Agent } from './Agent.js'
import type { WorldState } from './WorldState.js'

const EVIDENCE_CATEGORY_LABELS_EN: Record<string, string> = {
  DIRECT: 'Direct Evidence',
  EXPERT: 'Expert Opinion',
  WITNESS: 'Witness Testimony',
  CIRCUMSTANTIAL: 'Circumstantial Evidence',
  HEARSAY: 'Hearsay Evidence',
}

/**
 * 法官专用 Agent，采用 IRAC 司法推理框架：
 *   Issue（争议认定）→ Rule（法律规范）→ Application（事实涵摄）→ Conclusion（裁量结论）
 *
 * 同时具备举证责任状态感知和法条锚定能力（防幻觉引用）。
 */
export class JudgeAgent extends Agent {
  constructor(entity: LegalEntity, config: LLMConfig) {
    super(entity, config)
  }

  protected buildSystemPrompt(): string {
    const allowed = ROLE_ALLOWED_ACTIONS[this.entity.role] ?? []
    const lang = this.config.caseLanguage ?? 'zh'

    if (lang === 'en') {
      return `You are ${this.entity.name}, the presiding judge in this case.

Persona: ${this.entity.agentPersona}

【IRAC Judicial Reasoning Framework】— Every ruling must strictly follow these four steps:
1. **Issue** — Identify the specific legal dispute addressed in this ruling. Be precise and focused on this round's contested point, not a vague overview.
2. **Rule** — Cite the applicable statute or judicial interpretation (e.g., 14th Amendment Equal Protection Clause, Title VI § 601). Do not fabricate statutes.
3. **Application** — Apply the law to the established facts of this case. Analyze whether each element is satisfied; distinguish procedural rulings from substantive determinations.
4. **Conclusion** — Issue a clear ruling with stated grounds, demonstrating judicial impartiality.

【Evidence Review Standards】
- Direct evidence (documents, physical evidence, electronic data): Highest weight — prioritize admission
- Expert opinion: High weight — usable as technical fact basis
- Witness testimony: Medium weight — corroborate with other evidence
- Circumstantial evidence: Lower weight — insufficient alone to decide case
- Hearsay evidence: Lowest weight — treat with caution

【Burden of Proof Principles】
- Civil litigation: the party asserting a claim bears the burden of proof; once plaintiff establishes a prima facie case, the burden may shift to defendant
- When a party fails to meet its burden, you must note this in your reasoning and draw adverse inferences accordingly

You must maintain judicial impartiality at all times. Procedural and substantive justice are equally important.

You may only perform the following action types: ${allowed.join(', ')}

Output strict JSON only (no other text):
{
  "actionType": "action type enum value",
  "targetId": "target entity id (optional — omit if none)",
  "reasoning": "IRAC reasoning (Issue: dispute → Rule: cite specific statute → Application: fact analysis → Conclusion: ruling, 3-6 sentences)",
  "description": "your ruling action description (third person, 2-3 sentences, may cite statutes)",
  "intensity": 0.7,
  "directive": {
    "directiveType": "REQUIRE_EVIDENCE or LIMIT_ACTION or ORDER_TESTIMONY or GRANT_SETTLEMENT_WINDOW",
    "targetAgentId": "target entity id (optional)",
    "description": "directive content description",
    "duration": 2
  }
}
Notes:
- intensity: 0.1 = procedural/no position yet, 0.5 = preliminary inclination, 0.9 = clear substantive ruling (only when evidence and law are clear).
- directive is optional — add only when issuing a procedural order.
- Only cite statutes you are certain exist; use "applicable law" if uncertain.

IMPORTANT: The case materials are in English. You MUST respond entirely in English.`
    }

    return `你是 ${this.entity.name}，本案主审法官。

人格设定：${this.entity.agentPersona}

【IRAC 司法推理框架】— 你的每次裁量必须严格遵循以下四步：
1. **Issue（争议认定）** — 明确本次裁量针对的具体法律争议点，不笼统概括，聚焦本轮焦点
2. **Rule（法律规范）** — 援引适用的具体法条或司法解释（如《民法典》第577条、《劳动合同法》第87条），不可凭空捏造法条
3. **Application（事实涵摄）** — 将本案已查明事实代入法律规范，逐项分析是否满足构成要件，区分程序性裁定与实体性判断
4. **Conclusion（裁量结论）** — 作出明确的裁量意见，说明理由，体现司法中立

【证据审查标准】
- 直接证据（书证/物证/电子数据）：效力最高，优先采信
- 专家鉴定意见：较高效力，可作为技术事实认定依据
- 证人证词：中等效力，需结合其他证据印证
- 间接证据：较低效力，单独不足以定案
- 传闻证据：效力最低，需慎重对待

【举证责任原则】
- 民事诉讼"谁主张谁举证"；原告完成初步证明后，举证责任可转移至被告
- 当一方未能履行举证责任时，你应在推理中明确指出并做出不利于该方的程序性处理

你必须保持司法中立，不偏不倚。程序正义与实体正义并重。

你只能执行以下行动类型：${allowed.join(', ')}

输出严格 JSON（不要有其他文字）：
{
  "actionType": "行动类型枚举值",
  "targetId": "目标实体id（可选，无则省略）",
  "reasoning": "IRAC推理（Issue: 争议点→Rule: 引用具体法条→Application: 事实涵摄→Conclusion: 裁量意见，3-6句）",
  "description": "你的裁量行动描述（第三人称，2-3句，可引用法条）",
  "intensity": 0.7,
  "directive": {
    "directiveType": "REQUIRE_EVIDENCE 或 LIMIT_ACTION 或 ORDER_TESTIMONY 或 GRANT_SETTLEMENT_WINDOW",
    "targetAgentId": "目标实体id（可选）",
    "description": "指令内容描述",
    "duration": 2
  }
}
注意：
- intensity：0.1=程序性指令/暂不表态，0.5=初步倾向性意见，0.9=明确实体裁定（仅在证据充分且法律清晰时使用）。
- directive 为可选字段，当需要发出程序性指令时添加。
- 引用法条必须是真实存在的法条，如不确定请使用"相关法律规定"等模糊表述代替。`
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

    // 按原告/被告方分类整理法庭事件（含证据类型标注）
    const courtEvents = worldState.events.filter(e => IN_COURT_TYPES.has(e.type))
    const plaintiffEvents = courtEvents.filter(e => {
      const actor = worldState.entities.find(ent => ent.id === e.actorId)
      return actor?.role === 'PLAINTIFF' || actor?.role === 'PLAINTIFF_LAWYER'
    })
    const defendantEvents = courtEvents.filter(e => {
      const actor = worldState.entities.find(ent => ent.id === e.actorId)
      return actor?.role === 'DEFENDANT' || actor?.role === 'DEFENDANT_LAWYER'
    })

    const evLabels = lang === 'en' ? EVIDENCE_CATEGORY_LABELS_EN : EVIDENCE_CATEGORY_LABELS
    const formatEvents = (events: typeof courtEvents) =>
      events.slice(-5).map(e => {
        const actor = worldState.entities.find(ent => ent.id === e.actorId)?.name ?? e.actorId
        const evidenceTag = e.evidenceCategory
          ? `[${evLabels[e.evidenceCategory] ?? e.evidenceCategory}]`
          : ''
        const roundLabel = lang === 'en' ? `[R${e.round}]` : `[轮${e.round}]`
        return `${roundLabel} ${actor}${evidenceTag}: ${e.description.slice(0, 80)}`
      }).join('\n') || (lang === 'en' ? '(None)' : '（无）')

    const memoryText = this.memory.observations.length > 0
      ? this.memory.observations.slice(-8).join('\n')
      : (lang === 'en' ? '(Round 1 — no history yet)' : '（本轮是第一轮，尚无历史事件）')

    const historySection = this.memory.compressedHistory
      ? (lang === 'en'
          ? `\nEarly hearing recap:\n${this.memory.compressedHistory}\n`
          : `\n早期审理回顾：\n${this.memory.compressedHistory}\n`)
      : ''

    // 争议统计（含证据分级统计）
    const evidenceEvents = courtEvents.filter(e => e.type === 'EVIDENCE_SUBMISSION' || e.type === 'WITNESS_TESTIMONY')
    const crossExams = courtEvents.filter(e => e.type === 'CROSS_EXAMINATION').length
    const settlementOffers = courtEvents.filter(e => e.type === 'SETTLEMENT_OFFER').length

    const evidenceCatStats = evidenceEvents.reduce<Record<string, number>>((acc, e) => {
      const cat = e.evidenceCategory ?? 'DIRECT'
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})
    const evidenceSummary = Object.entries(evidenceCatStats)
      .map(([cat, cnt]) => `${evLabels[cat] ?? cat}×${cnt}`)
      .join(lang === 'en' ? ', ' : '、') || (lang === 'en' ? '(no evidence)' : '（无证据）')

    const disputeStats = lang === 'en'
      ? `Both parties have submitted ${evidenceEvents.length} pieces of evidence (${evidenceSummary}), ${crossExams} rounds of cross-examination` +
        (settlementOffers > 0 ? `, ${settlementOffers} settlement offer(s)` : '') + '.'
      : `双方已提交证据 ${evidenceEvents.length} 份（${evidenceSummary}），交叉询问 ${crossExams} 轮` +
        (settlementOffers > 0 ? `，和解要约 ${settlementOffers} 次` : '') + '。'

    // #5 法条注入（只对中文案件注入中文法条，英文案件跳过）
    const relevantStatutes = lang === 'zh' ? getRelevantStatutes(worldState.caseInput, 4) : []
    const statutesSection = relevantStatutes.length > 0
      ? `\n═══ 本案可能适用的法条参考 ═══\n` +
        relevantStatutes.map(s => `• ${s.code}：${s.content}`).join('\n') +
        `\n（以上法条仅供参考，你应根据实际情况援引，确认适用后再引用）\n`
      : ''

    // #4 举证责任状态注入
    const burdenSection = lang === 'en'
      ? `\n【Burden of Proof Status】\n${worldState.getBurdenText()}\n`
      : `\n【举证责任状态】\n${worldState.getBurdenText()}\n`

    const ownActionsText = this.memory.ownActions.slice(-3).map(a => {
      const roundLabel = lang === 'en' ? `[R${a.round}]` : `[轮${a.round}]`
      return `${roundLabel} ${a.description}`
    }).join('\n') || (lang === 'en' ? '(No rulings yet)' : '（尚未裁量）')

    if (lang === 'en') {
      return `Current situation:
${worldState.toSummaryText()}

${this.buildPhaseSection(worldState)}

Your relationship network:
${relText || '(No direct relationships)'}

═══ COURT EVIDENCE RECORD ═══
Burden & Evidence Summary: ${disputeStats}
${burdenSection}
【Plaintiff's Recent Actions】(evidence type in brackets)
${formatEvents(plaintiffEvents)}

【Defendant's Recent Actions】(evidence type in brackets)
${formatEvents(defendantEvents)}

═══════════════════
${statutesSection}
${this.buildDirectiveSection(worldState)}
${historySection}
Your recent observations:
${memoryText}

Your previous rulings:
${ownActionsText}

This is Round ${worldState.round}. Strictly follow the IRAC framework (Issue → Rule → Application → Conclusion) and make your decision:`
    }

    return `当前局势：
${worldState.toSummaryText()}

${this.buildPhaseSection(worldState)}

你的关系网络：
${relText || '（无直接关系）'}

═══ 法庭证据记录 ═══
举证责任与证据统计：${disputeStats}
${burdenSection}
【原告方近期行动】（括号内为证据类型）
${formatEvents(plaintiffEvents)}

【被告方近期行动】（括号内为证据类型）
${formatEvents(defendantEvents)}

═══════════════════
${statutesSection}
${this.buildDirectiveSection(worldState)}
${historySection}
你的近期观察：
${memoryText}

你之前的裁量：
${ownActionsText}

现在是第 ${worldState.round} 轮。请严格遵循 IRAC 框架（Issue争议认定→Rule援引法条→Application事实涵摄→Conclusion裁量结论）进行分析并做出决策：`
  }
}
