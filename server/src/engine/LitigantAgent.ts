import type { LegalEntity, LLMConfig, LawyerStrategyMode } from '@shared/types'
import { ROLE_ALLOWED_ACTIONS } from '@shared/constants'
import { Agent } from './Agent.js'
import type { WorldState } from './WorldState.js'

// #7 律师策略模式的详细指导（中文）
const STRATEGY_GUIDANCE_ZH: Record<LawyerStrategyMode, string> = {
  AGGRESSIVE_DISCOVERY: `【策略：激进取证】
- 核心目标：通过大量举证和交叉询问，快速建立己方证据优势
- 优先行动：EVIDENCE_SUBMISSION（尽可能提交高效力直接证据）> CROSS_EXAMINATION（找出对方证词矛盾）
- 行动强度通常较高（0.7-0.9），不给对方喘息机会
- 每次举证时主动标注证据类型（书证/物证/电子数据优先）`,

  PROCEDURAL_OBSTRUCTION: `【策略：程序阻击】
- 核心目标：利用程序规则消耗对方资源，制造拖延，寻找程序瑕疵
- 优先行动：ORAL_ARGUMENT（质疑程序合法性）> CROSS_EXAMINATION（挑战证据可采性）
- 行动强度中等（0.4-0.6），注重稳健而非冒进
- 关注法官的程序性指令，寻找对己方有利的程序间隙`,

  SETTLEMENT_ORIENTED: `【策略：和解导向】
- 核心目标：在适当时机推动和解，避免审判不确定性
- 优先行动：SETTLEMENT_OFFER（主动提出合理和解方案）> ORAL_ARGUMENT（展示对双方的现实风险）
- 行动强度中等偏低（0.3-0.6），避免激化对抗
- 每次发言时适当展示己方底线，为和解谈判留有空间`,

  NARRATIVE_FRAMING: `【策略：叙事建构】
- 核心目标：通过有力的事实叙述和情感渲染，在法官和社会面前建立有利的案件形象
- 优先行动：ORAL_ARGUMENT（用有力的叙事框架阐述己方立场）> EVIDENCE_SUBMISSION（精选有代表性证据）
- 注意与社会影响方（媒体、专家）的配合，形成舆论共鸣
- 行动描述应生动具体，突出人文关怀或社会正义角度`,

  LEGAL_TECHNICALITY: `【策略：法律技术】
- 核心目标：专注法条漏洞、诉讼时效、管辖权等程序性进攻点，从法律技术角度扭转局面
- 优先行动：ORAL_ARGUMENT（援引具体法条进行技术性辩论）> CROSS_EXAMINATION（质疑证据合法性）
- 行动强度较高（0.6-0.8），但措辞精准法律化
- 在 reasoning 中必须明确提及所援引的法条或法律原则`,
}

// #7 English lawyer strategy guidance
const STRATEGY_GUIDANCE_EN: Record<LawyerStrategyMode, string> = {
  AGGRESSIVE_DISCOVERY: `[Strategy: Aggressive Discovery]
- Core goal: Rapidly build an evidentiary advantage through extensive evidence submission and cross-examination
- Priority actions: EVIDENCE_SUBMISSION (submit high-weight direct evidence) > CROSS_EXAMINATION (expose contradictions in opposing testimony)
- Action intensity typically high (0.7-0.9) — give the opposing side no breathing room
- Explicitly note evidence type in each submission (documentary/physical/electronic preferred)`,

  PROCEDURAL_OBSTRUCTION: `[Strategy: Procedural Obstruction]
- Core goal: Exhaust opposing resources via procedural rules, create delays, and expose procedural defects
- Priority actions: ORAL_ARGUMENT (challenge procedural legitimacy) > CROSS_EXAMINATION (challenge admissibility)
- Action intensity moderate (0.4-0.6) — steady rather than reckless
- Watch for judge's procedural directives and exploit procedural gaps favorable to your client`,

  SETTLEMENT_ORIENTED: `[Strategy: Settlement-Oriented]
- Core goal: Push for settlement at the right moment to avoid trial uncertainty
- Priority actions: SETTLEMENT_OFFER (proactively propose reasonable settlement) > ORAL_ARGUMENT (demonstrate realistic risks to both sides)
- Action intensity moderate to low (0.3-0.6) — avoid escalating conflict
- Appropriately signal your client's bottom line in each statement to leave room for negotiation`,

  NARRATIVE_FRAMING: `[Strategy: Narrative Framing]
- Core goal: Build a favorable case image before the judge and public through compelling factual narrative and emotional framing
- Priority actions: ORAL_ARGUMENT (present your position using a powerful narrative) > EVIDENCE_SUBMISSION (select representative, impactful evidence)
- Coordinate with social actors (media, experts) to create resonance
- Descriptions should be vivid and specific, emphasizing human interest or social justice angles`,

  LEGAL_TECHNICALITY: `[Strategy: Legal Technicality]
- Core goal: Focus on statutory loopholes, statutes of limitation, jurisdiction, and other procedural attack points to shift the case outcome
- Priority actions: ORAL_ARGUMENT (cite specific statutes for technical arguments) > CROSS_EXAMINATION (challenge evidence legality)
- Action intensity relatively high (0.6-0.8), but precise and legally formal in language
- Reasoning must explicitly reference the statute or legal principle being invoked`,
}

/**
 * 诉讼当事人及律师专用 Agent，采用策略感知诉讼推理框架：
 *   提取案件事实 → 策略匹配 → 行动目标确定 → 法律论证构建
 *
 * 适用角色：PLAINTIFF, DEFENDANT, PLAINTIFF_LAWYER, DEFENDANT_LAWYER
 * 律师角色支持五种策略模式（#7 律师策略库）。
 */
export class LitigantAgent extends Agent {
  constructor(entity: LegalEntity, config: LLMConfig) {
    super(entity, config)
  }

  private isLawyer(): boolean {
    return this.entity.role === 'PLAINTIFF_LAWYER' || this.entity.role === 'DEFENDANT_LAWYER'
  }

  private isPlaintiffSide(): boolean {
    return this.entity.role === 'PLAINTIFF' || this.entity.role === 'PLAINTIFF_LAWYER'
  }

  private getSideName(lang: 'zh' | 'en'): string {
    if (lang === 'en') return this.isPlaintiffSide() ? 'plaintiff' : 'defendant'
    return this.isPlaintiffSide() ? '原告' : '被告'
  }

  protected buildSystemPrompt(): string {
    const allowed = ROLE_ALLOWED_ACTIONS[this.entity.role] ?? []
    const lang = this.config.caseLanguage ?? 'zh'
    const side = this.getSideName(lang)
    const isLawyer = this.isLawyer()

    if (lang === 'en') {
      const strategyGuidance = isLawyer && this.entity.lawyerStrategy
        ? `\n${STRATEGY_GUIDANCE_EN[this.entity.lawyerStrategy]}\n`
        : isLawyer
        ? `As the ${side}'s attorney, you excel at:
- Evidence organization and submission strategy: present evidence in the most favorable order
- Cross-examination technique: expose contradictions and weaknesses in opposing witnesses
- Procedural strategy: use procedural rules to gain favorable litigation momentum
- Legal argument construction: cite real statutes and precedents to support your client's claims`
        : `As the ${side} party, your actions are characterized by:
- Factual testimony: provide authentic firsthand account of the facts
- Articulating interests: clearly state your core claims and bottom line
- Submitting evidence: provide direct evidence favorable to your side (prioritize documents, recordings, electronic data)
- Reasonable positioning: demonstrate a firm but reasonable stance in settlement negotiations`

      return `You are ${this.entity.name}, the ${side}-side ${isLawyer ? 'attorney' : 'party'} in this case.

Your position: ${this.entity.position}
Your overall inclination: ${this.entity.supportsPlaintiff === undefined ? 'Neutral / undecided' : this.entity.supportsPlaintiff ? 'Leans toward plaintiff' : 'Leans toward defendant'}
Your interests: ${this.entity.interests.join(', ')}
Your action strategy: ${this.entity.strategy}
Persona: ${this.entity.agentPersona}

${strategyGuidance}

【Litigation Reasoning Framework】— Follow this framework each round:
1. **Extract case facts** — Identify facts favorable/unfavorable to your side; assess the strength and weight hierarchy of both parties' evidence (direct evidence strongest, hearsay weakest)
2. **Strategy alignment** — Does the current phase and situation fit your strategy? Do you need to adjust tactics?
3. **Define action goal** — What specific litigation objective do you aim to achieve this round, and how will it shift the burden and probability?
4. **Legal argument** — Organize your legal points; cite real statutes where applicable; build an argument that can persuade the judge

You may only perform the following action types: ${allowed.join(', ')}

Output strict JSON only (no other text):
{
  "actionType": "action type enum value",
  "targetId": "target entity id (optional — omit if none)",
  "reasoning": "litigation reasoning (framework: facts → strategy → goal → legal argument, 3-5 sentences)",
  "description": "action description (third person, 2-3 sentences; when submitting evidence, note the type e.g. 'documentary evidence'/'recording'/'expert opinion')",
  "intensity": 0.7
}
Note: intensity 0-1 action strength: 0.1 = mild/probing, 0.5 = routine, 0.9 = full push / key evidence submission.

IMPORTANT: The case materials are in English. You MUST respond entirely in English.`
    }

    // Chinese version
    const strategyGuidance = isLawyer && this.entity.lawyerStrategy
      ? `\n${STRATEGY_GUIDANCE_ZH[this.entity.lawyerStrategy]}\n`
      : isLawyer
      ? `作为${side}方代理律师，你擅长：
- 证据组织与举证策略：选择最有利的证据呈现顺序和方式
- 交叉询问技巧：找出对方证人证词中的矛盾和漏洞
- 程序性策略：利用程序规则争取有利的诉讼节奏
- 法律论点构建：引用真实法条和判例支撑己方主张`
      : `作为${side}方当事人，你的行动特点是：
- 事实陈述：基于亲历者视角提供真实的事实描述
- 利益诉求：清晰表达你的核心诉求和底线
- 证据提供：提交对己方有利的直接证据（优先提供书证、录像、电子数据等高效力证据）
- 合理表态：在和解谈判中展现合理但坚定的立场`

    return `你是 ${this.entity.name}，本案${side}方${isLawyer ? '代理律师' : '当事人'}。

你的立场：${this.entity.position}
你的整体倾向：${this.entity.supportsPlaintiff === undefined ? '中立/待定' : this.entity.supportsPlaintiff ? '更支持原告' : '更支持被告'}
你的利益诉求：${this.entity.interests.join('、')}
你的行动策略：${this.entity.strategy}
人格设定：${this.entity.agentPersona}

${strategyGuidance}

【诉讼推理框架】— 每轮必须按此框架分析：
1. **提取案件事实** — 从当前局势识别对己方有利/不利的事实，评估双方证据强弱和效力等级（直接证据最强，传闻证据最弱）
2. **策略匹配** — 当前阶段和局势是否符合己方策略？是否需要调整战术？
3. **明确行动目标** — 本轮行动要达成的具体诉讼目标，对举证责任和概率的预期影响
4. **法律论证** — 组织法律论点，如有法条可援引请使用真实法条，构建能说服法官的论证

你只能执行以下行动类型：${allowed.join(', ')}

输出严格 JSON（不要有其他文字）：
{
  "actionType": "行动类型枚举值",
  "targetId": "目标实体id（可选，无则省略）",
  "reasoning": "诉讼推理过程（框架展开：事实分析→策略匹配→目标→法律论证，3-5句）",
  "description": "行动描述（第三人称，2-3句，举证时标注证据类型如"书证"/"录音"/"鉴定意见"）",
  "intensity": 0.7
}
注意：intensity 为 0-1 的行动强度，0.1=温和保守/试探，0.5=常规推进，0.9=全力攻防/关键举证。`
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

    // 提取对方近期行动，帮助诉讼方了解对手动态
    const opponentRoles = this.isPlaintiffSide()
      ? ['DEFENDANT', 'DEFENDANT_LAWYER']
      : ['PLAINTIFF', 'PLAINTIFF_LAWYER']

    const opponentEvents = worldState.events
      .filter(e => {
        const actor = worldState.entities.find(ent => ent.id === e.actorId)
        return actor && opponentRoles.includes(actor.role)
      })
      .slice(-5)
      .map(e => {
        const actor = worldState.entities.find(ent => ent.id === e.actorId)?.name ?? e.actorId
        const roundLabel = lang === 'en' ? `[R${e.round}]` : `[轮${e.round}]`
        return `${roundLabel} ${actor}: ${e.description.slice(0, 80)}`
      })
      .join('\n') || (lang === 'en' ? '(No opposing actions yet)' : '（对方暂无行动）')

    // 法官近期裁量
    const judgeEvents = worldState.events
      .filter(e => {
        const actor = worldState.entities.find(ent => ent.id === e.actorId)
        return actor?.role === 'JUDGE'
      })
      .slice(-3)
      .map(e => {
        const roundLabel = lang === 'en' ? `[R${e.round}]` : `[轮${e.round}]`
        return `${roundLabel} ${e.description.slice(0, 80)}`
      })
      .join('\n') || (lang === 'en' ? '(No rulings yet)' : '（法官尚未裁量）')

    const memoryText = this.memory.observations.length > 0
      ? this.memory.observations.slice(-8).join('\n')
      : (lang === 'en' ? '(Round 1 — no history yet)' : '（本轮是第一轮，尚无历史事件）')

    const historySection = this.memory.compressedHistory
      ? (lang === 'en'
          ? `\nEarly litigation recap:\n${this.memory.compressedHistory}\n`
          : `\n早期诉讼回顾：\n${this.memory.compressedHistory}\n`)
      : ''

    // 证据强度对比
    const ownSideRoles = this.isPlaintiffSide()
      ? ['PLAINTIFF', 'PLAINTIFF_LAWYER']
      : ['DEFENDANT', 'DEFENDANT_LAWYER']
    const ownSideShift = worldState.events
      .filter(e => { const a = worldState.entities.find(ent => ent.id === e.actorId); return a && ownSideRoles.includes(a.role) })
      .reduce((sum, e) => sum + Math.abs(e.probabilityShift), 0)
    const opponentShift = worldState.events
      .filter(e => { const a = worldState.entities.find(ent => ent.id === e.actorId); return a && opponentRoles.includes(a.role) })
      .reduce((sum, e) => sum + Math.abs(e.probabilityShift), 0)
    const evidenceComparison = lang === 'en'
      ? `Your side's cumulative evidence impact: ${ownSideShift.toFixed(0)}%, opponent's cumulative impact: ${opponentShift.toFixed(0)}%.`
      : `己方证据累计影响 ${ownSideShift.toFixed(0)}%，对方累计影响 ${opponentShift.toFixed(0)}%。`

    // #4 举证责任状态
    const burdenText = worldState.getBurdenText()
    const isMyBurden = (
      (this.isPlaintiffSide() && worldState.burdenOfProof.currentBearingParty === 'PLAINTIFF') ||
      (!this.isPlaintiffSide() && worldState.burdenOfProof.currentBearingParty === 'DEFENDANT') ||
      worldState.burdenOfProof.currentBearingParty === 'SHARED'
    )
    const burdenAlert = isMyBurden && !worldState.burdenOfProof.standardMet
      ? (lang === 'en'
          ? `\n⚠ [Burden of Proof Alert] You currently bear the burden of proof and have not yet established sufficient evidence. Prioritize submitting high-weight evidence (documentary evidence / expert opinions)!`
          : `\n⚠ 【举证责任提醒】当前你方承担举证责任，尚未完成充分举证，建议优先提交高效力证据（书证/鉴定意见）！`)
      : ''

    // 本轮对方已发生的行动（用于对抗性反驳）
    const thisRoundOpponentActions = worldState.events
      .filter(e => {
        if (e.round !== worldState.round) return false
        const actor = worldState.entities.find(ent => ent.id === e.actorId)
        return actor && opponentRoles.includes(actor.role)
      })
      .map(e => {
        const actor = worldState.entities.find(ent => ent.id === e.actorId)?.name ?? e.actorId
        return `${actor}: ${e.description.slice(0, 80)}`
      })
      .join('\n')

    const rebuttalSection = thisRoundOpponentActions
      ? (lang === 'en'
          ? `\n【Opposing Actions This Round (you may directly rebut these)】\n${thisRoundOpponentActions}\n`
          : `\n【本轮对方刚刚采取的行动（可直接针对性反驳）】\n${thisRoundOpponentActions}\n`)
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

【Burden of Proof Status】
${burdenText}${burdenAlert}

【Evidence Strength Comparison】
${evidenceComparison}

【Opposing Party's Recent Moves】
${opponentEvents}
${rebuttalSection}
【Judge's Recent Rulings】
${judgeEvents}
${this.buildDirectiveSection(worldState)}
${historySection}
Your memory (recent observations):
${memoryText}

Your previous actions:
${ownActionsText}

This is Round ${worldState.round}. Follow the litigation reasoning framework (facts → strategy → goal → legal argument) and decide your action:`
    }

    return `当前局势：
${worldState.toSummaryText()}

${this.buildPhaseSection(worldState)}

你的关系网络：
${relText || '（无直接关系）'}

【举证责任状态】
${burdenText}${burdenAlert}

【证据强度对比】
${evidenceComparison}

【对方近期动态】
${opponentEvents}
${rebuttalSection}
【法官近期裁量】
${judgeEvents}
${this.buildDirectiveSection(worldState)}
${historySection}
你的记忆（近期观察）：
${memoryText}

你之前的行动：
${ownActionsText}

现在是第 ${worldState.round} 轮。请按照诉讼推理框架（事实分析→策略匹配→目标→法律论证）进行分析并做出决策：`
  }
}
