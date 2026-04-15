import type { EntityRole, ProceedingType, TrialPhase } from '@shared/types'
import { ROLE_ALLOWED_ACTIONS } from '@shared/constants'

const PHASE_LABELS_ZH: Record<TrialPhase, string> = {
  OPENING: '开庭陈述',
  EVIDENCE: '举证质证',
  DEBATE: '法庭辩论',
  CLOSING: '最后陈述/宣判',
}

const PHASE_LABELS_EN: Record<TrialPhase, string> = {
  OPENING: 'Opening Statements',
  EVIDENCE: 'Evidence & Examination',
  DEBATE: 'Oral Arguments',
  CLOSING: 'Closing Statements / Judgment',
}

// Default export keeps Chinese for backward compatibility
export const PHASE_LABELS = PHASE_LABELS_ZH

export function getPhaseLabelMap(lang: 'zh' | 'en' = 'zh'): Record<TrialPhase, string> {
  return lang === 'en' ? PHASE_LABELS_EN : PHASE_LABELS_ZH
}

/**
 * 根据当前轮次和总轮数确定审判阶段。
 * OPENING  ~15% | EVIDENCE ~35% | DEBATE ~30% | CLOSING ~20%
 */
export function getTrialPhase(round: number, totalRounds: number): TrialPhase {
  const ratio = round / totalRounds
  if (ratio <= 0.15) return 'OPENING'
  if (ratio <= 0.50) return 'EVIDENCE'
  if (ratio <= 0.80) return 'DEBATE'
  return 'CLOSING'
}

/**
 * 按阶段和角色返回行动指引（2-3 句），支持中英文。
 */
export function getPhaseGuidance(phase: TrialPhase, role: EntityRole, lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    const guidanceEN: Record<TrialPhase, Partial<Record<EntityRole, string>>> = {
      OPENING: {
        PLAINTIFF: 'This is the Opening Statements phase. State the case facts, core claims, and your position clearly.',
        DEFENDANT: 'This is the Opening Statements phase. State your defense and rebuttal arguments, and make your position clear.',
        PLAINTIFF_LAWYER: 'This is the Opening Statements phase. Outline your key claims and evidence points to build initial persuasiveness.',
        DEFENDANT_LAWYER: 'This is the Opening Statements phase. Outline your defense strategy and respond to plaintiff\'s claims.',
        JUDGE: 'This is the Opening Statements phase. No rulings needed yet — listen carefully to both sides.',
        WITNESS: 'This is the Opening Statements phase. No testimony required at this stage.',
      },
      EVIDENCE: {
        PLAINTIFF: 'This is the Evidence & Examination phase. Submit key evidence and actively respond to challenges.',
        DEFENDANT: 'This is the Evidence & Examination phase. Submit defense evidence and cross-examine plaintiff\'s exhibits.',
        PLAINTIFF_LAWYER: 'This is the Evidence & Examination phase. Organize your evidence chain, request cross-examination of opposing witnesses, and undermine their evidentiary foundation.',
        DEFENDANT_LAWYER: 'This is the Evidence & Examination phase. Challenge the admissibility and probative value of plaintiff\'s evidence while submitting your own.',
        JUDGE: 'This is the Evidence & Examination phase. Review admissibility and relevance of evidence; issue procedural directives as needed.',
        WITNESS: 'This is the Evidence & Examination phase. Truthfully state the facts you know and answer attorneys\' questions.',
      },
      DEBATE: {
        PLAINTIFF: 'This is the Oral Arguments phase. Make your final statements focused on the key disputed issues.',
        DEFENDANT: 'This is the Oral Arguments phase. Make your final defense statements focused on the key disputed issues.',
        PLAINTIFF_LAWYER: 'This is the Oral Arguments phase. Build a complete legal argument, citing evidence and statutes to persuade the judge.',
        DEFENDANT_LAWYER: 'This is the Oral Arguments phase. Systematically rebut plaintiff\'s arguments and construct your own legal theory.',
        JUDGE: 'This is the Oral Arguments phase. Guide both parties to focus on core disputes and identify the key contested issues.',
        WITNESS: 'This is the Oral Arguments phase. No testimony required at this stage.',
      },
      CLOSING: {
        PLAINTIFF: 'This is the Closing Statements phase. Deliver your final summation, emphasizing core claims.',
        DEFENDANT: 'This is the Closing Statements phase. Deliver your final defense summation, emphasizing rebuttal grounds.',
        PLAINTIFF_LAWYER: 'This is the Closing Statements phase. Deliver a final summation synthesizing all case evidence to support your client\'s claims.',
        DEFENDANT_LAWYER: 'This is the Closing Statements phase. Deliver a final defense summation comprehensively arguing your client\'s position.',
        JUDGE: 'This is the Judgment phase. Synthesize all evidence and both parties\' arguments to form a clear judicial ruling.',
        WITNESS: 'This is the Judgment phase. No testimony required.',
      },
    }

    const roleGuidance = guidanceEN[phase][role]
    if (roleGuidance) return roleGuidance

    const socialGuidanceEN: Record<TrialPhase, string> = {
      OPENING: 'The case has just opened. You may observe and share your initial views.',
      EVIDENCE: 'The case is in the evidence phase. Key evidence is being disclosed — you may comment on it.',
      DEBATE: 'The case is in the arguments phase. Both sides\' positions are clear — you may weigh in on contested issues.',
      CLOSING: 'The case is about to be decided. You may state your final position and predictions.',
    }
    return socialGuidanceEN[phase]
  }

  // Chinese guidance
  const guidance: Record<TrialPhase, Partial<Record<EntityRole, string>>> = {
    OPENING: {
      PLAINTIFF: '本阶段为开庭陈述阶段，你应当陈述案件事实和核心诉求，表明立场。',
      DEFENDANT: '本阶段为开庭陈述阶段，你应当陈述答辩意见和抗辩理由，表明立场。',
      PLAINTIFF_LAWYER: '本阶段为开庭陈述阶段，你应当概述己方主要主张和证据要点，建立初步说服力。',
      DEFENDANT_LAWYER: '本阶段为开庭陈述阶段，你应当概述答辩要点和抗辩策略，回应原告主张。',
      JUDGE: '本阶段为开庭陈述阶段，你暂不需要裁量，注意倾听双方陈述。',
      WITNESS: '本阶段为开庭陈述阶段，暂时不需要你作证。',
    },
    EVIDENCE: {
      PLAINTIFF: '本阶段为举证质证阶段，你应当提交关键证据，积极回应对方质疑。',
      DEFENDANT: '本阶段为举证质证阶段，你应当提交抗辩证据，对原告证据进行质证。',
      PLAINTIFF_LAWYER: '本阶段为举证质证阶段，你应组织证据链、申请交叉询问对方证人，动摇对方证据基础。',
      DEFENDANT_LAWYER: '本阶段为举证质证阶段，你应质疑原告证据的可采性和证明力，提交己方证据。',
      JUDGE: '本阶段为举证质证阶段，你应当审查证据的可采性和关联性，必要时发出程序性指令。',
      WITNESS: '本阶段为举证质证阶段，你应当如实陈述所知事实，回答律师提问。',
    },
    DEBATE: {
      PLAINTIFF: '本阶段为法庭辩论阶段，你应当围绕争议焦点进行最终陈述。',
      DEFENDANT: '本阶段为法庭辩论阶段，你应当围绕争议焦点进行最终答辩。',
      PLAINTIFF_LAWYER: '本阶段为法庭辩论阶段，你应当构建完整的法律论证，引用证据和法条说服法官。',
      DEFENDANT_LAWYER: '本阶段为法庭辩论阶段，你应当系统反驳原告论点，构建己方法律论证体系。',
      JUDGE: '本阶段为法庭辩论阶段，你应当引导双方聚焦核心争议，归纳争议焦点。',
      WITNESS: '本阶段为法庭辩论阶段，暂时不需要你作证。',
    },
    CLOSING: {
      PLAINTIFF: '本阶段为最后陈述阶段，你应当做最终总结陈词，强调核心诉求。',
      DEFENDANT: '本阶段为最后陈述阶段，你应当做最终总结答辩，强调抗辩理由。',
      PLAINTIFF_LAWYER: '本阶段为最后陈述阶段，你应当做最终总结陈词，综合全案证据论证己方主张。',
      DEFENDANT_LAWYER: '本阶段为最后陈述阶段，你应当做最终总结答辩，综合论证己方抗辩立场。',
      JUDGE: '本阶段为宣判阶段，你应当综合全案证据和双方论点，形成明确的裁判意见。',
      WITNESS: '本阶段为宣判阶段，无需作证。',
    },
  }

  const roleGuidance = guidance[phase][role]
  if (roleGuidance) return roleGuidance

  // 社会影响方的通用指引
  const socialGuidance: Record<TrialPhase, string> = {
    OPENING: '案件刚刚开庭，你可以关注并发表初步看法。',
    EVIDENCE: '案件进入举证阶段，关键证据正在披露，你可以据此发声。',
    DEBATE: '案件进入辩论阶段，双方立场已明确，你可以针对争议焦点表态。',
    CLOSING: '案件即将宣判，你可以发表最终立场和预测。',
  }
  return socialGuidance[phase]
}

/**
 * 按阶段缩窄角色可选行动。
 */
export function getPhaseAllowedActions(phase: TrialPhase, role: EntityRole): ProceedingType[] {
  const base = ROLE_ALLOWED_ACTIONS[role] ?? []

  // 社会方和证人不受阶段限制
  if (!['PLAINTIFF', 'DEFENDANT', 'PLAINTIFF_LAWYER', 'DEFENDANT_LAWYER', 'JUDGE'].includes(role)) {
    return base
  }

  const phaseRestrictions: Record<TrialPhase, Set<ProceedingType>> = {
    OPENING: new Set(['CROSS_EXAMINATION', 'SETTLEMENT_OFFER'] as ProceedingType[]),
    EVIDENCE: new Set<ProceedingType>(), // 全部允许
    DEBATE: new Set(['EVIDENCE_SUBMISSION'] as ProceedingType[]),
    CLOSING: new Set(['SETTLEMENT_OFFER'] as ProceedingType[]),
  }

  const restricted = phaseRestrictions[phase]
  const filtered = base.filter(a => !restricted.has(a))

  // 确保至少保留一个可选行动
  return filtered.length > 0 ? filtered : base
}
