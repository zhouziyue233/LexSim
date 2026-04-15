import type {
  LegalEntity,
  RelationshipGraph,
  GameplayTimeline,
  GameplayEvent,
  PredictionReport,
  LLMConfig,
} from '@shared/types'
import { IN_COURT_TYPES, PROCEEDING_TYPE_MAP, EVIDENCE_CATEGORY_LABELS, getRelevantStatutes } from '@shared/constants'
import { getTrialPhase, PHASE_LABELS } from '../engine/trial-phase.js'
import type { SSEStream } from './sse.js'
import { chatJSON, safeParseJSON, normalizeReportProbabilities } from './llm.service.js'
import OpenAI from 'openai'

// ─── Tools (pure data analysis, no LLM) ──────────────────────────────────────

interface ToolResult {
  name: string
  output: string
}

function evidenceAnalysisTool(entities: LegalEntity[], events: GameplayEvent[]): ToolResult {
  const courtEvents = events.filter(e => IN_COURT_TYPES.has(e.type))
  const byActor = new Map<string, GameplayEvent[]>()
  for (const ev of courtEvents) {
    const list = byActor.get(ev.actorId) ?? []
    list.push(ev)
    byActor.set(ev.actorId, list)
  }

  const analysis: string[] = []
  for (const [actorId, actorEvents] of byActor) {
    const entity = entities.find(e => e.id === actorId)
    if (!entity) continue
    const totalShift = actorEvents.reduce((s, e) => s + e.probabilityShift, 0)
    const avgIntensity = Math.abs(totalShift / actorEvents.length).toFixed(1)
    // #3 证据效力统计
    const evidenceEvents = actorEvents.filter(e =>
      e.type === 'EVIDENCE_SUBMISSION' || e.type === 'WITNESS_TESTIMONY')
    const catStats = evidenceEvents.reduce<Record<string, number>>((acc, e) => {
      const cat = e.evidenceCategory ?? 'DIRECT'
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})
    const catText = Object.entries(catStats)
      .map(([cat, cnt]) => `${EVIDENCE_CATEGORY_LABELS[cat] ?? cat}×${cnt}`)
      .join('、')
    const evidenceNote = catText ? ` [证据分级: ${catText}]` : ''
    analysis.push(
      `${entity.name}（${entity.role}）: ${actorEvents.length}次法庭行动，` +
      `累计影响${totalShift > 0 ? '+' : ''}${totalShift}%，平均${avgIntensity}%${evidenceNote}`
    )
  }

  // 高效力 vs 低效力证据全局对比
  const allEvidenceEvents = courtEvents.filter(e =>
    e.type === 'EVIDENCE_SUBMISSION' || e.type === 'WITNESS_TESTIMONY')
  const highWeight = allEvidenceEvents.filter(e => (e.evidenceWeightMultiplier ?? 1) >= 0.85).length
  const lowWeight = allEvidenceEvents.filter(e => (e.evidenceWeightMultiplier ?? 1) < 0.65).length
  const weightSummary = allEvidenceEvents.length > 0
    ? `\n证据效力分布：高效力证据${highWeight}份，低效力证据${lowWeight}份，共${allEvidenceEvents.length}份举证`
    : ''

  return {
    name: 'evidence_analysis',
    output: `法庭证据分析（含效力分级）：\n${analysis.join('\n')}${weightSummary}\n\n法庭事件总计：${courtEvents.length}个`,
  }
}

function timelineAnalysisTool(events: GameplayEvent[], entities: LegalEntity[]): ToolResult {
  // Find turning points (events with largest |probabilityShift|)
  const sorted = [...events].sort((a, b) => Math.abs(b.probabilityShift) - Math.abs(a.probabilityShift))
  const top5 = sorted.slice(0, 5)

  const turningPoints = top5.map(ev => {
    const actor = entities.find(e => e.id === ev.actorId)?.name ?? ev.actorId
    return `轮${ev.round}: ${actor} · ${PROCEEDING_TYPE_MAP[ev.type] ?? ev.type} · 影响${ev.probabilityShift > 0 ? '+' : ''}${ev.probabilityShift}% · "${ev.description.slice(0, 50)}"`
  })

  return {
    name: 'timeline_analysis',
    output: `关键转折点（按影响力排序）：\n${turningPoints.join('\n')}`,
  }
}

function sentimentAnalysisTool(events: GameplayEvent[]): ToolResult {
  const socialEvents = events.filter(e => !IN_COURT_TYPES.has(e.type))
  let cumSentiment = 0
  const trajectory: string[] = []

  for (const ev of socialEvents) {
    cumSentiment += ev.publicSentimentDelta ?? 0
    trajectory.push(`轮${ev.round} ${ev.type}: 舆论变化${(ev.publicSentimentDelta ?? 0) > 0 ? '+' : ''}${ev.publicSentimentDelta ?? 0}（累计${cumSentiment}）`)
  }

  const direction = cumSentiment > 20 ? '强烈支持原告' :
    cumSentiment > 0 ? '略微支持原告' :
    cumSentiment < -20 ? '强烈支持被告' :
    cumSentiment < 0 ? '略微支持被告' : '中立'

  return {
    name: 'sentiment_analysis',
    output: `公众舆论轨迹：\n${trajectory.join('\n')}\n\n总体方向：${direction}（最终指数${cumSentiment}）`,
  }
}

function probabilityCalculator(timeline: GameplayTimeline): ToolResult {
  const prob = timeline.currentPlaintiffWinProb
  const defProb = 100 - prob
  const settlementProb = prob > 30 && prob < 70 ? Math.round(30 + (50 - Math.abs(prob - 50))) : Math.round(15)

  return {
    name: 'probability_calculator',
    output: `概率计算结果：
原告胜诉概率：${prob}%
被告胜诉概率：${defProb}%
和解概率估算：${settlementProb}%（基于双方实力均衡度）
社会影响指数：${timeline.socialInfluenceScore}`,
  }
}

function riskAssessmentTool(events: GameplayEvent[], entities: LegalEntity[]): ToolResult {
  const risks: string[] = []

  // Check for settlement offers
  const settlements = events.filter(e => e.type === 'SETTLEMENT_OFFER')
  if (settlements.length > 0) {
    risks.push('和解风险：已有和解要约提出，需评估和解条件优劣')
  }

  // Check for strong political pressure
  const politicalEvents = events.filter(e => e.type === 'LEGISLATIVE_MOTION' || e.type === 'GOVT_STATEMENT')
  if (politicalEvents.length >= 2) {
    risks.push('政治干预风险：多次立法/政府行动可能影响司法独立性')
  }

  // Check for media exposure
  const mediaEvents = events.filter(e => e.type === 'MEDIA_REPORT' || e.type === 'SOCIAL_POST')
  if (mediaEvents.length >= 3) {
    risks.push('舆论风险：大量媒体/社交报道可能带来舆论审判压力')
  }

  return {
    name: 'risk_assessment',
    output: `风险识别结果：\n${risks.length > 0 ? risks.join('\n') : '未发现显著风险'}`,
  }
}

function relationshipEvolutionTool(
  graph: RelationshipGraph,
  events: GameplayEvent[],
  entities: LegalEntity[],
): ToolResult {
  // Count interactions between entity pairs
  const pairCounts = new Map<string, number>()
  for (const ev of events) {
    if (!ev.targetId) continue
    const key = [ev.actorId, ev.targetId].sort().join('↔')
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }

  // Top interaction pairs
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const [a, b] = key.split('↔')
      const nameA = entities.find(e => e.id === a)?.name ?? a
      const nameB = entities.find(e => e.id === b)?.name ?? b
      return `${nameA} ↔ ${nameB}: ${count}次交互`
    })

  // Analyze edge characteristics
  const strongEdges = graph.edges
    .filter(e => e.strength >= 0.6)
    .map(e => {
      const src = entities.find(ent => ent.id === e.source)?.name ?? e.source
      const tgt = entities.find(ent => ent.id === e.target)?.name ?? e.target
      return `${src} → ${tgt}: ${e.label}（强度${e.strength.toFixed(2)}，${e.adversarial ? '对抗' : '协作'}）`
    })

  const adversarialCount = graph.edges.filter(e => e.adversarial).length
  const cooperativeCount = graph.edges.filter(e => !e.adversarial).length

  return {
    name: 'relationship_evolution',
    output: `关系演化分析：
对抗关系${adversarialCount}条，协作关系${cooperativeCount}条

高频互动实体对：
${topPairs.join('\n') || '（无显著互动）'}

强关系边（strength≥0.6）：
${strongEdges.join('\n') || '（无强关系）'}`,
  }
}

function phaseAnalysisTool(
  events: GameplayEvent[],
  entities: LegalEntity[],
  totalRounds: number,
): ToolResult {
  const phases = ['OPENING', 'EVIDENCE', 'DEBATE', 'CLOSING'] as const
  const phaseData = phases.map(phase => {
    const phaseEvents = events.filter(e => getTrialPhase(e.round, totalRounds) === phase)
    if (phaseEvents.length === 0) return { phase, summary: '（无事件）' }

    const netShift = phaseEvents.reduce((s, e) => s + e.probabilityShift, 0)
    const actorCounts = new Map<string, number>()
    for (const e of phaseEvents) {
      actorCounts.set(e.actorId, (actorCounts.get(e.actorId) ?? 0) + 1)
    }
    const topActor = [...actorCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const topActorName = entities.find(e => e.id === topActor?.[0])?.name ?? topActor?.[0] ?? '未知'

    return {
      phase,
      summary: `${phaseEvents.length}个事件，概率净变化${netShift > 0 ? '+' : ''}${netShift}%，最活跃: ${topActorName}（${topActor?.[1] ?? 0}次行动）`,
    }
  })

  const output = phaseData.map(d =>
    `【${PHASE_LABELS[d.phase]}】${d.summary}`
  ).join('\n')

  return {
    name: 'phase_analysis',
    output: `审判阶段分析：\n${output}`,
  }
}

// ─── 工具 8：诉讼请求满足度分析（#9 新增）────────────────────────────────────

function prayerForReliefAnalysisTool(
  events: GameplayEvent[],
  entities: LegalEntity[],
  timeline: GameplayTimeline,
): ToolResult {
  const courtEvents = events.filter(e => IN_COURT_TYPES.has(e.type))
  const plaintiffRoles = ['PLAINTIFF', 'PLAINTIFF_LAWYER']
  const defendantRoles = ['DEFENDANT', 'DEFENDANT_LAWYER']

  const pEvents = courtEvents.filter(e => {
    const a = entities.find(ent => ent.id === e.actorId)
    return a && plaintiffRoles.includes(a.role)
  })
  const dEvents = courtEvents.filter(e => {
    const a = entities.find(ent => ent.id === e.actorId)
    return a && defendantRoles.includes(a.role)
  })

  const pTotalShift = pEvents.reduce((s, e) => s + e.probabilityShift, 0)
  const dTotalShift = Math.abs(dEvents.reduce((s, e) => s + e.probabilityShift, 0))
  const prob = timeline.currentPlaintiffWinProb

  // 估算各诉请满足度
  const fullSupportEst = prob > 70 ? Math.round(prob * 0.6) : prob > 50 ? Math.round(prob * 0.4) : Math.round(prob * 0.2)
  const partialSupportEst = prob > 30
    ? Math.min(60, Math.round(30 + Math.abs(prob - 50) * 0.6))
    : Math.round(prob * 0.5)
  const coreClaimEst = prob > 50
    ? Math.min(90, Math.round(prob * 0.9))
    : Math.round(prob * 0.7)

  // 证据权重加成分析
  const weightedEvidence = pEvents.filter(e => e.evidenceWeightMultiplier && e.evidenceWeightMultiplier >= 0.85)
  const evidenceStrength = weightedEvidence.length > 0
    ? `原告已提交 ${weightedEvidence.length} 份高效力证据（鉴定意见/直接证据），对核心诉请支持度较强`
    : `原告高效力证据偏少，核心诉请存在证明力不足的风险`

  return {
    name: 'prayer_for_relief_analysis',
    output: `诉讼请求满足度分析：
当前胜诉概率：${prob}%
全部诉请均获支持（估算）：${fullSupportEst}%
部分诉请获支持（估算）：${partialSupportEst}%（最可能结果）
核心诉请获支持（估算）：${coreClaimEst}%

原告举证效力累积：${pTotalShift.toFixed(1)}（被告反驳：${dTotalShift.toFixed(1)}）
${evidenceStrength}

注：以上为基于博弈数据的估算，最终应结合具体诉请内容综合判断。`,
  }
}

// ─── 工具 9：判决执行风险分析（#9 新增）─────────────────────────────────────

function enforcementRiskTool(
  events: GameplayEvent[],
  entities: LegalEntity[],
  timeline: GameplayTimeline,
): ToolResult {
  const risks: string[] = []
  const mitigations: string[] = []

  // 检测被告方经济能力信号（通过案件描述和角色分析）
  const defendant = entities.find(e => e.role === 'DEFENDANT')
  if (defendant) {
    if (defendant.position.includes('公司') || defendant.position.includes('企业')) {
      mitigations.push('被告为法人主体，执行时可查封企业账户、资产')
    } else {
      risks.push('被告为自然人，资产查询和强制执行难度较高')
    }
  }

  // 检测是否有政府/立法干预（可能影响执行）
  const govtEvents = events.filter(e => e.type === 'GOVT_STATEMENT' || e.type === 'LEGISLATIVE_MOTION')
  if (govtEvents.length >= 2) {
    const isProPlaintiff = govtEvents.filter(e => e.impact === 'POSITIVE').length > govtEvents.filter(e => e.impact === 'NEGATIVE').length
    if (isProPlaintiff) {
      mitigations.push('政府/立法机关表态支持原告，执行过程可能获得行政协助')
    } else {
      risks.push('政府/立法机关倾向保护被告，可能增加执行阻力')
    }
  }

  // 社会关注度影响执行
  const mediaEvents = events.filter(e => e.type === 'MEDIA_REPORT')
  if (mediaEvents.length >= 3) {
    mitigations.push(`案件媒体曝光度高（${mediaEvents.length}次报道），社会监督有助于判决执行`)
  }

  // 和解信号：已有和解要约则执行风险降低
  const settleEvents = events.filter(e => e.type === 'SETTLEMENT_OFFER')
  if (settleEvents.length > 0) {
    mitigations.push('双方均有和解意向，判决前达成执行和解的可能性较大')
  }

  // 基于概率评估整体执行可行性
  const execFeasibility = timeline.currentPlaintiffWinProb > 65 ? '较高' : timeline.currentPlaintiffWinProb > 40 ? '中等' : '较低'

  return {
    name: 'enforcement_risk',
    output: `判决执行风险分析：
整体执行可行性：${execFeasibility}

执行风险因素：
${risks.length > 0 ? risks.map(r => `⚠ ${r}`).join('\n') : '（未发现显著执行风险）'}

有利执行因素：
${mitigations.length > 0 ? mitigations.map(m => `✓ ${m}`).join('\n') : '（暂无明显有利因素）'}

建议：胜诉后应及时向法院申请财产保全，锁定被告可供执行财产。`,
  }
}

// ─── 工具 10：上诉风险评估（#9 新增）────────────────────────────────────────

function appealRiskTool(
  events: GameplayEvent[],
  entities: LegalEntity[],
  timeline: GameplayTimeline,
): ToolResult {
  const prob = timeline.currentPlaintiffWinProb

  // 争议点法律确定性评估
  const crossExams = events.filter(e => e.type === 'CROSS_EXAMINATION').length
  const judicialRulings = events.filter(e => e.type === 'JUDICIAL_RULING').length
  const expertEvents = events.filter(e => e.type === 'EXPERT_OPINION').length

  // 争议激烈程度 → 上诉可能性
  const contestedness = crossExams + expertEvents
  let appealLikelihood: string
  let appealBasis: string[]

  if (prob > 75) {
    appealLikelihood = '较低（原告明显占优，被告上诉获益有限）'
    appealBasis = ['被告若不服可能以"证据不足"为由上诉，但改判概率较低']
  } else if (prob < 35) {
    appealLikelihood = '较高（被告占优，原告可能就法律适用提起上诉）'
    appealBasis = ['原告可能对法律适用问题提起上诉', '若存在程序瑕疵，原告有较强上诉理由']
  } else {
    appealLikelihood = '中等（双方势均力敌，一审结果易被上诉挑战）'
    appealBasis = ['双方均有上诉动机', '法律适用争议大，二审改判概率较高']
  }

  // 程序风险（法官裁量次数过多/过少）
  const procedureRisks: string[] = []
  if (judicialRulings === 0) {
    procedureRisks.push('法官裁量记录为零，可能存在程序问题风险')
  }
  if (contestedness >= 5) {
    procedureRisks.push(`交叉询问和专家争议频繁（共${contestedness}次），事实认定存在争议，上诉改判风险偏高`)
  }

  return {
    name: 'appeal_risk',
    output: `上诉风险评估：
上诉可能性：${appealLikelihood}

主要上诉理由预测：
${appealBasis.map(b => `• ${b}`).join('\n')}

程序风险提示：
${procedureRisks.length > 0 ? procedureRisks.map(r => `⚠ ${r}`).join('\n') : '（程序上未见明显瑕疵）'}

司法数据参考：民事案件二审维持原判率约70-80%，但事实争议大的案件改判率显著上升。`,
  }
}

// ─── ReACT Report Agent ──────────────────────────────────────────────────────

const TOOLS = [
  { name: 'evidence_analysis', description: '分析各方法庭证据的强弱、类型（直接/专家/证人/间接/传闻）和影响力' },
  { name: 'timeline_analysis', description: '识别博弈过程中的关键转折点' },
  { name: 'sentiment_analysis', description: '分析公众舆论变化轨迹和方向' },
  { name: 'probability_calculator', description: '计算最终胜诉和和解概率' },
  { name: 'risk_assessment', description: '识别案件潜在风险因素（和解、政治干预、舆论压力）' },
  { name: 'relationship_evolution', description: '分析各方关系的演化趋势（对抗/协作、强度变化）' },
  { name: 'phase_analysis', description: '按审判阶段（开庭→举证→辩论→宣判）分析博弈进展' },
  { name: 'prayer_for_relief_analysis', description: '逐维度分析诉讼请求满足度：全部支持/部分支持/核心诉请支持的各自概率' },
  { name: 'enforcement_risk', description: '评估胜诉后判决的执行可行性与执行风险（被告资产、政治阻力、社会压力）' },
  { name: 'appeal_risk', description: '评估一审判决被上诉和二审改判的风险及主要上诉理由' },
]

export async function generateReportReACT(
  caseInput: string,
  entities: LegalEntity[],
  timeline: GameplayTimeline,
  config: LLMConfig,
  emitter: SSEStream,
  graph?: RelationshipGraph,
  totalRounds?: number,
): Promise<PredictionReport> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.apiBase })
  const effectiveTotalRounds = totalRounds ?? (timeline.events.length > 0 ? Math.max(...timeline.events.map(e => e.round)) : 10)

  const toolFns: Record<string, () => ToolResult> = {
    evidence_analysis: () => evidenceAnalysisTool(entities, timeline.events),
    timeline_analysis: () => timelineAnalysisTool(timeline.events, entities),
    sentiment_analysis: () => sentimentAnalysisTool(timeline.events),
    probability_calculator: () => probabilityCalculator(timeline),
    risk_assessment: () => riskAssessmentTool(timeline.events, entities),
    relationship_evolution: () => relationshipEvolutionTool(
      graph ?? { nodes: entities, edges: [] }, timeline.events, entities,
    ),
    phase_analysis: () => phaseAnalysisTool(timeline.events, entities, effectiveTotalRounds),
    // #9 新增三个法律专用工具
    prayer_for_relief_analysis: () => prayerForReliefAnalysisTool(timeline.events, entities, timeline),
    enforcement_risk: () => enforcementRiskTool(timeline.events, entities, timeline),
    appeal_risk: () => appealRiskTool(timeline.events, entities, timeline),
  }

  const toolDescriptions = TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')

  // Build context gradually via ReACT loop
  let context = `案件事实：${caseInput.slice(0, 500)}

参与主体（${entities.length}人）：
${entities.map(e => `- ${e.name}（${e.role}）`).join('\n')}

博弈事件总计：${timeline.events.length}个
最终胜诉概率：${timeline.currentPlaintiffWinProb}%
最终社会影响指数：${timeline.socialInfluenceScore}`

  const isEn = config.caseLanguage === 'en'
  const MAX_ITERATIONS = 5
  const usedTools = new Set<string>()

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const remainingTools = TOOLS.filter(t => !usedTools.has(t.name))
    if (remainingTools.length === 0) break

    const thoughtPrompt = isEn
      ? `You are a senior legal counsel using the ReACT pattern to analyze a case.

Current known information:
${context}

Available analysis tools:
${remainingTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Select the next tool to use. Output strict JSON:
{"thought": "your reasoning (why you chose this tool)", "tool": "tool name"}

If you believe you have sufficient information to generate the report, output:
{"thought": "sufficient information gathered", "tool": "DONE"}`
      : `你是一位资深法律顾问，正在使用 ReACT 模式分析案件。

当前已知信息：
${context}

可用分析工具：
${remainingTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

请选择下一个要使用的工具进行分析。输出严格 JSON：
{"thought": "你的推理（为什么选择这个工具）", "tool": "工具名称"}

如果你认为已有足够信息生成报告，输出：
{"thought": "信息已充分", "tool": "DONE"}`

    try {
      const decision = await chatJSON<{ thought: string; tool: string }>(
        isEn
          ? 'You are a legal analysis ReACT Agent. Select a tool or finish analysis. Respond in English.'
          : '你是法律分析 ReACT Agent。选择工具或结束分析。',
        thoughtPrompt,
        config,
      )

      emitter.emit('stage:chunk', { stage: 4, text: `\nThought: ${decision.thought}\n` })

      if (decision.tool === 'DONE') break

      const toolName = decision.tool
      if (!toolFns[toolName]) break

      usedTools.add(toolName)
      const result = toolFns[toolName]()

      emitter.emit('stage:chunk', { stage: 4, text: `Action: ${toolName}\nObservation: ${result.output}\n` })
      context += `\n\n[${toolName}]\n${result.output}`
    } catch {
      break
    }
  }

  // Final report generation
  emitter.emit('stage:chunk', { stage: 4, text: isEn ? '\nGenerating final report...\n' : '\n生成最终报告...\n' })

  // 注入法条参考（#5 防幻觉，仅中文案件）
  const relevantStatutes = isEn ? [] : getRelevantStatutes(caseInput, 5)
  const statutesHint = relevantStatutes.length > 0
    ? `\n本案可能适用的真实法条参考（援引时请确认适用性）：\n` +
      relevantStatutes.map(s => `• ${s.code}：${s.content}`).join('\n') + '\n'
    : ''

  const reportPrompt = isEn
    ? `Based on the complete analysis below, generate a professional legal prediction report in JSON format.

${context}

【Probability values — strictly required】
plaintiffWinProbability MUST be ${Math.round(timeline.currentPlaintiffWinProb)} (computed by the simulation algorithm — do not change)
defendantWinProbability MUST be ${100 - Math.round(timeline.currentPlaintiffWinProb)} (= 100 - above value — do not change)

【Report generation requirements】
1. courtJudgment.judicialAnalysis is the core legal analysis section. Write from the perspective of a simulated judge using the IRAC framework, integrating legal reasoning and statutory application:
   - [Issue]: Begin with "The Court finds the central dispute in this case concerns…" and identify 1-3 core legal issues.
   - [Rule]: Cite specific real statutes (e.g., 42 U.S.C. § 2000d, U.S. Const. amend. XIV), stating the applicable rule and elements.
   - [Application]: Apply the law to the specific facts of this case, analyzing each element, evaluating both parties' claims and defenses, and explaining how the court interprets and applies each statute.
   - [Conclusion]: Conclude with "Accordingly, the Court holds…" and state the ruling tendency, legal consequences, and primary grounds.
   Minimum 400 words; professional, formal judicial opinion style.

2. courtJudgment.citedStatutes: List 2-4 actually cited statutes — must be real.
3. outcomeProbabilities: Break down win probability by claim dimension (full / partial / core claim / settlement).
4. enforcementRisk: 50-100 words assessing enforcement risks.
5. appealRisk: 50-100 words assessing appeal and reversal risk.
6. litigationStrategy: Based on the full simulation (round-by-round evidence battles, probability trend, key turning points), provide strategic advice for each side. Must include:
   - Core advantages in this case (which evidence/arguments are favorable)
   - Main weaknesses (which rounds saw probability drops, which arguments were undermined)
   - Specific improvement strategies (evidence sequencing, argument strengthening, rebuttal focus)
   Minimum 150 words per side. Focus on process optimization, not just outcome response.
7. phaseAnalysis: For each of the four phases (OPENING/EVIDENCE/DEBATE/CLOSING), provide a detailed summary of the litigation dynamics, evidence battles, probability shifts, and key events. Minimum 150 words per phase.

Output strict JSON only (no extra text):
{
  "plaintiffWinProbability": integer (sum with defendantWinProbability = 100),
  "defendantWinProbability": integer (sum with plaintiffWinProbability = 100),
  "settlementProbability": integer (0-100, independent of win probability),
  "disputePoints": ["disputed issue 1", "disputed issue 2"],
  "courtJudgment": {
    "evidenceAdoption": [{"key": "evidence name/description", "side": "PLAINTIFF or DEFENDANT", "weight": "CRITICAL/STRONG/MODERATE/WEAK", "analysis": "court's analysis of this evidence (including type)", "roundRef": round number}],
    "judicialAnalysis": "simulated judge IRAC analysis (Issue→Rule→Application→Conclusion, 400+ words, judicial opinion style, in English)",
    "citedStatutes": [{"code": "statute citation", "relevance": "relevance to this case"}],
    "keyFactFindings": ["key factual finding 1", "key factual finding 2"]
  },
  "litigationStrategy": {"plaintiff": "plaintiff strategy analysis based on full simulation (strengths, weaknesses, improvement strategies, 150+ words)", "defendant": "defendant strategy analysis based on full simulation (strengths, weaknesses, improvement strategies, 150+ words)"},
  "predictedOutcome": "predicted judgment outcome",
  "compensationRange": {"min": 0, "max": 0, "currency": "USD"},
  "outcomeProbabilities": {
    "overall": integer,
    "fullSupport": integer (probability of full claim support),
    "partialSupport": integer (probability of partial support — usually highest),
    "coreClaimSupport": integer (probability of core claim support),
    "settlementLikelihood": integer (settlement probability),
    "compensationEstimate": {"low": number, "mid": number, "high": number, "currency": "USD"}
  },
  "enforcementRisk": "enforcement risk assessment text (in English)",
  "appealRisk": "appeal reversal risk assessment text (in English)",
  "phaseAnalysis": [{"phase": "OPENING", "summary": "opening statements phase detailed analysis (150+ words)"}, {"phase": "EVIDENCE", "summary": "evidence & examination phase detailed analysis (150+ words)"}, {"phase": "DEBATE", "summary": "oral arguments phase detailed analysis (150+ words)"}, {"phase": "CLOSING", "summary": "closing/judgment phase detailed analysis (150+ words)"}],
  "socialImpactAnalysis": "social impact analysis (in English)"
}`
    : `基于以下完整分析结果，生成专业法律预测报告 JSON。
${statutesHint}
${context}

【概率数值要求 - 严格遵守】
plaintiffWinProbability 必须填写 ${Math.round(timeline.currentPlaintiffWinProb)}（由博弈算法精确计算，不可修改）
defendantWinProbability 必须填写 ${100 - Math.round(timeline.currentPlaintiffWinProb)}（= 100 - 上值，不可修改）

【报告生成要求】
1. courtJudgment.judicialAnalysis 是核心法律分析部分，须以模拟法官第一视角，运用 IRAC 框架撰写，将法律推理与法律适用融为一体，要求如下：
   - 【Issue · 争议认定】：以"本院认为，本案争议焦点在于……"开篇，明确列出核心法律争议点（1-3个）。
   - 【Rule · 法律规范】：援引具体真实法条（从上方参考法条中选取，或使用"《XX法》第X条"格式），阐明各争议点对应的规范依据与构成要件。
   - 【Application · 事实涵摄与法律适用】：将案件具体事实逐项代入法条构成要件进行细致分析，评判各方主张与抗辩的法律成立性，同时说明法院对相关法条的具体适用方式（含解释立场与裁量空间）。此部分须兼顾法律推理过程与法条适用论证，不得将二者割裂。
   - 【Conclusion · 裁量结论】：以"综上，本院认定……"结尾，给出明确的判决倾向、法律后果及主要理由。
   全文不少于 600 字，行文须专业、严谨，符合中国司法文书风格。

2. courtJudgment.citedStatutes：列出 2-4 个实际援引的法条，必须是真实存在的法条。
3. outcomeProbabilities：按诉请维度拆解胜诉概率（全部/部分/核心诉请/和解）。
4. enforcementRisk：50-100字，评估执行风险。
5. appealRisk：50-100字，评估上诉改判风险。
6. litigationStrategy：基于博弈模拟全过程（各轮次证据攻防、概率走势、关键转折点）分别为原被告提供策略建议。须包含：
   - 己方在本案中的核心优势（哪些证据/论点有利）
   - 己方的主要薄弱环节（哪些轮次概率下滑、论点被削弱）
   - 针对上述优劣势的具体改进策略（举证顺序、论点强化、反驳要点等）
   不得仅描述"如何应对已知判决结果"，须聚焦诉讼过程本身的策略优化，每方不少于150字。
7. phaseAnalysis：四个阶段（OPENING/EVIDENCE/DEBATE/CLOSING）每阶段 summary 须详细分析该阶段的博弈动态、证据交锋、概率变化及关键事件，每阶段不少于200字。

输出严格 JSON（不要有额外文字）：
{
  "plaintiffWinProbability": 整数（与defendantWinProbability之和=100）,
  "defendantWinProbability": 整数（与plaintiffWinProbability之和=100）,
  "settlementProbability": 整数（0-100，独立于胜诉概率）,
  "disputePoints": ["争议点1", "争议点2"],
  "courtJudgment": {
    "evidenceAdoption": [{"key": "证据名/描述", "side": "PLAINTIFF或DEFENDANT", "weight": "CRITICAL/STRONG/MODERATE/WEAK", "analysis": "法院对该证据的采信分析（含证据类型）", "roundRef": 轮次编号}],
    "judicialAnalysis": "模拟法官 IRAC 判决说理（Issue→Rule→Application→Conclusion，法律推理与法律适用融合，600字以上，司法文书风格）",
    "citedStatutes": [{"code": "法条名称", "relevance": "与本案的关联性说明"}],
    "keyFactFindings": ["关键事实认定1", "关键事实认定2"]
  },
  "litigationStrategy": {"plaintiff": "基于博弈全过程的原告策略分析（优势、薄弱环节、改进策略，150字以上）", "defendant": "基于博弈全过程的被告策略分析（优势、薄弱环节、改进策略，150字以上）"},
  "predictedOutcome": "判决结果预测",
  "compensationRange": {"min": 0, "max": 0, "currency": "CNY"},
  "outcomeProbabilities": {
    "overall": 整数,
    "fullSupport": 整数（全部诉请被支持概率）,
    "partialSupport": 整数（部分支持概率，通常最高）,
    "coreClaimSupport": 整数（核心诉请被支持概率）,
    "settlementLikelihood": 整数（和解概率）,
    "compensationEstimate": {"low": 数值, "mid": 数值, "high": 数值, "currency": "CNY"}
  },
  "enforcementRisk": "执行风险评估文字",
  "appealRisk": "上诉改判风险评估文字",
  "phaseAnalysis": [{"phase": "OPENING", "summary": "开庭陈述阶段详细分析（200字以上）"}, {"phase": "EVIDENCE", "summary": "举证质证阶段详细分析（200字以上）"}, {"phase": "DEBATE", "summary": "法庭辩论阶段详细分析（200字以上）"}, {"phase": "CLOSING", "summary": "宣判阶段详细分析（200字以上）"}],
  "socialImpactAnalysis": "社会影响分析"
}`

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: isEn
          ? 'You are a senior legal counsel. Generate a strict JSON prediction report based on the analysis results. Respond entirely in English.'
          : '你是资深法律顾问。根据分析结果生成严格 JSON 格式的预测报告。',
      },
      { role: 'user', content: reportPrompt },
    ],
    stream: true,
  })

  let full = ''
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    full += text
    emitter.emit('stage:chunk', { stage: 4, text })
  }

  const parsed = safeParseJSON<PredictionReport>(full)

  // 用 Stage 3 算法计算的最终概率覆盖 LLM 估算值，确保报告与概率走势曲线一致
  const computedPlaintiff = Math.round(timeline.currentPlaintiffWinProb)
  const computedDefendant = 100 - computedPlaintiff
  parsed.plaintiffWinProbability = computedPlaintiff
  parsed.defendantWinProbability = computedDefendant

  // outcomeProbabilities.overall 同步更新
  if (parsed.outcomeProbabilities) {
    parsed.outcomeProbabilities.overall = computedPlaintiff
  }

  return normalizeReportProbabilities(parsed)
}
