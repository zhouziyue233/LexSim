import OpenAI from 'openai'
import type {
  LLMConfig,
  LegalEntity,
  RelationEdge,
  GameplayEvent,
  PredictionReport,
  RelationshipGraph,
  GameplayTimeline,
} from '@shared/types'

function createClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiBase,
  })
}

/**
 * Detects whether the case text is primarily Chinese or English.
 * Returns 'zh' if CJK characters make up more than 10% of non-whitespace chars.
 */
export function detectCaseLanguage(text: string): 'zh' | 'en' {
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
  const total = text.replace(/\s/g, '').length
  return total > 0 && cjkCount / total > 0.10 ? 'zh' : 'en'
}

/** Returns a language instruction to append to system prompts for English-language cases. */
function langNote(config: LLMConfig): string {
  return config.caseLanguage === 'en'
    ? '\n\nIMPORTANT: The case materials are in English. You MUST respond entirely in English. All output — entity names, descriptions, reasoning, analysis — must be written in English.'
    : ''
}

export function safeParseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}

export function normalizeReportProbabilities(report: PredictionReport): PredictionReport {
  let p = Math.round(report.plaintiffWinProbability ?? 50)
  let d = Math.round(report.defendantWinProbability ?? 50)

  p = Math.max(0, Math.min(100, p))
  d = Math.max(0, Math.min(100, d))

  const sum = p + d
  if (sum !== 100 && sum > 0) {
    p = Math.round((p / sum) * 100)
    d = 100 - p
  } else if (sum === 0) {
    p = 50
    d = 50
  }

  return {
    ...report,
    plaintiffWinProbability: p,
    defendantWinProbability: d,
    settlementProbability: Math.max(0, Math.min(100, Math.round(report.settlementProbability ?? 0))),
  }
}

// ─── Case Summary ────────────────────────────────────────────────────────────

export async function summarizeCaseBackground(
  effectiveCaseInput: string,
  config: LLMConfig,
): Promise<string> {
  const client = createClient(config)

  const isEn = config.caseLanguage === 'en'
  const systemPrompt = isEn
    ? `You are a professional legal case analysis AI. Your task is to synthesize the provided case background (which may include uploaded file content and supplementary notes) into a concise, structured case summary.

Requirements:
1. Summarize core case information in 200-400 words
2. Include: case type, basic information about the parties, core facts, disputed issues, key evidence, social context
3. Write clearly and concisely, suitable as a case overview
4. Output the summary body directly — no titles, prefixes (e.g. "Structured Case Summary"), or Markdown markup (e.g. ** bold)`
    : `你是一位专业法律案件分析 AI。你的任务是将用户提供的案件背景信息（可能包含上传文件内容和手动补充说明）整合为一段简洁、结构化的案件背景摘要。

要求：
1. 用 300-500 字概括案件核心信息
2. 包含：案件类型、当事人基本情况、核心事实、争议焦点、关键证据、社会背景
3. 语言精炼、条理清晰，适合作为案件概览展示
4. 直接输出摘要正文，不要有任何标题、前缀（如"案件结构化摘要"）或 Markdown 标记（如 ** 加粗）${langNote(config)}`

  const userPrompt = `以下是案件的原始背景信息，请综合整理为结构化摘要：

${effectiveCaseInput}`

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
  })

  return (response.choices[0]?.message?.content ?? '').trim()
}

// ─── Stage 1: Extract Entities ────────────────────────────────────────────────

export async function extractEntities(
  caseInput: string,
  config: LLMConfig,
  onStream?: (chunk: string) => void,
): Promise<LegalEntity[]> {
  const client = createClient(config)

  const isEn = config.caseLanguage === 'en'
  const systemPrompt = isEn
    ? `You are a professional legal case analysis AI. Your task is to identify all relevant parties from the case facts and generate structured agent profiles.

Important rules:
1. Must identify litigation parties (plaintiff, defendant, lawyers, judge, witnesses)
2. Must identify social actors surrounding the case (affected public groups, online influencers/KOLs, legislators, government agencies, media outlets, academic experts, NGOs/advocacy organizations)
3. For social actors, output caseInfluence (case influence 0-100)
4. For all parties except the judge, determine whether their overall stance leans toward the plaintiff or defendant, and set supportsPlaintiff (true/false). Balance social actors between plaintiff-supporting and defendant-supporting — in reality, government agencies, some media, and industry experts often side with the defendant
5. For lawyer roles (PLAINTIFF_LAWYER / DEFENDANT_LAWYER), assign a lawyerStrategy that differs between the two sides to reflect adversarial dynamics

lawyerStrategy enum values (lawyers only):
- AGGRESSIVE_DISCOVERY: Aggressive evidence gathering (suited for the side with strong evidence)
- PROCEDURAL_OBSTRUCTION: Procedural obstruction (suited for the weaker side needing delay)
- SETTLEMENT_ORIENTED: Settlement-oriented (suited for parties preferring out-of-court resolution)
- NARRATIVE_FRAMING: Narrative framing (suited for parties with moral/public opinion advantage)
- LEGAL_TECHNICALITY: Legal technicality (suited for parties relying on procedural or statutory loopholes)

EntityRole enum values (use strictly):
- Litigation parties: PLAINTIFF, DEFENDANT, PLAINTIFF_LAWYER, DEFENDANT_LAWYER, JUDGE, WITNESS
- Social actors: PUBLIC_STAKEHOLDER, ONLINE_INFLUENCER, LEGISLATOR, GOVERNMENT_AGENCY, MEDIA_OUTLET, EXPERT_COMMENTATOR, ADVOCACY_GROUP

EntityCategory: COURT (litigation party) or SOCIAL (social actor)

IMPORTANT: Output all names, descriptions, positions, strategies, and personas in English.`
    : `你是一位专业法律案件分析 AI。你的任务是从案件事实中识别所有相关主体，并生成结构化的 Agent 设定。

重要规则：
1. 必须识别诉讼主体（原告、被告、律师、法官、证人）
2. 必须识别案件周边的社会影响方（利益相关公众群体、网络博主/KOL、立法会议员、政府单位、媒体机构、学术专家、NGO/倡导组织）
3. 对社会主体输出 caseInfluence（案件影响力 0-100）
4. 对除法官外的主体，尽量判断其整体立场更偏向原告还是被告，并写入 supportsPlaintiff（true/false）。社会影响方（SOCIAL类）中支持原告与支持被告的主体数量应尽量均衡，避免大多数社会影响方都倾向同一方——现实中政府机构、部分媒体、行业专家等往往站在被告立场
5. 对律师角色（PLAINTIFF_LAWYER / DEFENDANT_LAWYER），根据案件特点分配 lawyerStrategy 策略模式，使两方律师策略有差异化

lawyerStrategy 枚举值（仅律师角色使用）：
- AGGRESSIVE_DISCOVERY：激进取证（适合证据充分的一方）
- PROCEDURAL_OBSTRUCTION：程序阻击（适合证据较弱、需要拖延的一方）
- SETTLEMENT_ORIENTED：和解导向（适合损失可控、偏好庭外解决的一方）
- NARRATIVE_FRAMING：叙事建构（适合道德/舆论优势明显的一方）
- LEGAL_TECHNICALITY：法律技术（适合依赖程序/法条漏洞的一方）

EntityRole 枚举值（严格使用）：
- 诉讼主体：PLAINTIFF, DEFENDANT, PLAINTIFF_LAWYER, DEFENDANT_LAWYER, JUDGE, WITNESS
- 社会影响方：PUBLIC_STAKEHOLDER, ONLINE_INFLUENCER, LEGISLATOR, GOVERNMENT_AGENCY, MEDIA_OUTLET, EXPERT_COMMENTATOR, ADVOCACY_GROUP

EntityCategory：COURT（诉讼主体）或 SOCIAL（社会影响方）`

  const userPrompt = isEn
    ? `Case facts:
${caseInput}

Analyze and identify all relevant parties. Output strict JSON only (no extra text):
{
  "entities": [
    {
      "id": "e1",
      "name": "party name (in English)",
      "role": "EntityRole enum value",
      "category": "COURT or SOCIAL",
      "supportsPlaintiff": true,
      "position": "position description (1-2 sentences, in English)",
      "interests": ["interest 1", "interest 2"],
      "strategy": "action strategy description (1-2 sentences, in English)",
      "agentPersona": "detailed agent persona (2-3 sentences including background, personality, core motivation, in English)",
      "followerScale": "SMALL",
      "caseInfluence": 50,
      "lawyerStrategy": "strategy enum value (lawyers only — omit for other roles)"
    }
  ]
}
Notes:
- Social actors: fill in followerScale and caseInfluence; omit inapplicable fields for court parties
- If judge/neutral witness stance cannot be determined, omit supportsPlaintiff
- Lawyer roles (PLAINTIFF_LAWYER/DEFENDANT_LAWYER) must include lawyerStrategy; use different strategies for each side`
    : `以下是案件事实描述：
${caseInput}

请分析并识别所有相关主体，输出严格的 JSON 格式（不要有任何额外文字）：
{
  "entities": [
    {
      "id": "e1",
      "name": "主体名称",
      "role": "EntityRole 枚举值",
      "category": "COURT 或 SOCIAL",
      "supportsPlaintiff": true,
      "position": "立场描述（1-2句）",
      "interests": ["利益诉求1", "利益诉求2"],
      "strategy": "行动策略描述（1-2句）",
      "agentPersona": "详细的 Agent 人格设定（2-3句，包括背景、性格、核心动机）",
      "followerScale": "SMALL",
      "caseInfluence": 50,
      "lawyerStrategy": "策略枚举值（仅律师角色填写，其他角色省略）"
    }
  ]
}
注意：
- 社会主体填写 followerScale 和 caseInfluence，法庭主体不适用的字段可省略
- 若无法明确判断法官/中立证人立场，可省略 supportsPlaintiff
- 律师角色（PLAINTIFF_LAWYER/DEFENDANT_LAWYER）必须填写 lawyerStrategy，且两方律师尽量使用不同策略以体现对抗性`

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  })

  let full = ''
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    full += text
    onStream?.(text)
  }

  const parsed = safeParseJSON<{ entities: LegalEntity[] }>(full)
  return parsed.entities
}

// ─── Stage 2: Build Relationship Graph ───────────────────────────────────────

export async function buildRelationshipGraph(
  entities: LegalEntity[],
  config: LLMConfig,
  onStream?: (chunk: string) => void,
): Promise<RelationshipGraph> {
  const client = createClient(config)

  const isEn = config.caseLanguage === 'en'
  const systemPrompt = isEn
    ? `You are a legal relationship network analyst. Based on the given legal case parties, construct a relationship network graph between them.

RelationType enum values (use strictly):
- LITIGATION (adversarial litigation)
- INTEREST_ALIGN (aligned interests / alliance)
- EVIDENCE_LINK (evidentiary connection)
- REPRESENT (representation / agency relationship)
- WITNESS_FOR (witness connection)
- MEDIA_COVERAGE (media coverage)
- POLITICAL_PRESSURE (political pressure)
- PUBLIC_SUPPORT (public support)
- PUBLIC_OPPOSITION (public opposition)
- REGULATORY_OVERSIGHT (regulatory oversight)

IMPORTANT: All labels must be written in English.`
    : `你是一位法律关系网络分析师。基于给定的法律案件主体，构建主体间的关系网络图。

RelationType 枚举值（严格使用）：
- LITIGATION（诉讼对抗）
- INTEREST_ALIGN（利益同盟）
- EVIDENCE_LINK（证据关联）
- REPRESENT（代理关系）
- WITNESS_FOR（证人关联）
- MEDIA_COVERAGE（媒体报道）
- POLITICAL_PRESSURE（政治施压）
- PUBLIC_SUPPORT（公众支持）
- PUBLIC_OPPOSITION（公众反对）
- REGULATORY_OVERSIGHT（监管关系）`

  const userPrompt = isEn
    ? `Identified parties:
${JSON.stringify(entities.map(e => ({ id: e.id, name: e.name, role: e.role, position: e.position })), null, 2)}

Analyze all significant relationships between parties. Output strict JSON only (no extra text):
{
  "edges": [
    {
      "id": "r1",
      "source": "party id",
      "target": "party id",
      "type": "RelationType enum value",
      "label": "brief relationship description (3-6 words, in English)",
      "strength": 0.8,
      "adversarial": true
    }
  ]
}
Note: strength is relationship intensity 0-1; adversarial indicates whether the relationship is adversarial.`
    : `已识别的主体列表：
${JSON.stringify(entities.map(e => ({ id: e.id, name: e.name, role: e.role, position: e.position })), null, 2)}

请分析所有主体间的重要关系，输出严格 JSON（不要有额外文字）：
{
  "edges": [
    {
      "id": "r1",
      "source": "主体id",
      "target": "主体id",
      "type": "RelationType 枚举值",
      "label": "关系简述（4-8字）",
      "strength": 0.8,
      "adversarial": true
    }
  ]
}
注意：strength 为 0-1 的关系强度，adversarial 表示是否对抗性关系。`

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  })

  let full = ''
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    full += text
    onStream?.(text)
  }

  const parsed = safeParseJSON<{ edges: RelationEdge[] }>(full)
  return { nodes: entities, edges: parsed.edges }
}

// ─── Stage 3 (legacy single-call — replaced by engine in Phase 5) ────────────

export async function simulateGameplayLegacy(
  entities: LegalEntity[],
  graph: RelationshipGraph,
  caseInput: string,
  config: LLMConfig,
  onEvent: (event: GameplayEvent, prob: number, sentiment: number) => void,
): Promise<GameplayTimeline> {
  const client = createClient(config)

  const systemPrompt = `你是一个多智能体法律博弈模拟器。根据案件主体的设定和关系网络，模拟真实的诉讼过程。

模拟规则：
1. 共进行 4-5 轮，每轮包含 2-4 个事件
2. 法庭内事件（证据提交、辩论、裁量）与庭外事件（媒体报道、议员发声、公众行动）交替进行
3. 每个事件后更新原告胜诉概率（初始 50%）
4. 社会主体的行动影响社会影响指数（socialInfluenceScore，初始 0，范围 -100~100）
5. 社会影响指数持续影响法官的裁量倾向
6. 模拟真实诉讼的不确定性和战略博弈

ProceedingType 枚举（法庭内）：EVIDENCE_SUBMISSION, CROSS_EXAMINATION, ORAL_ARGUMENT, SETTLEMENT_OFFER, JUDICIAL_RULING, WITNESS_TESTIMONY
ProceedingType 枚举（法庭外）：MEDIA_REPORT, SOCIAL_POST, LEGISLATIVE_MOTION, GOVT_STATEMENT, PUBLIC_PROTEST, EXPERT_OPINION

每个事件严格使用此格式输出（不要有其他文字）：
[EVENT]
{
  "id": "ev1",
  "round": 1,
  "timestamp": "第1天",
  "type": "EVIDENCE_SUBMISSION",
  "actorId": "实体id",
  "targetId": "实体id（可选）",
  "description": "事件详细描述（2-3句）",
  "impact": "POSITIVE",
  "probabilityShift": 5,
  "publicSentimentDelta": 0
}
[/EVENT]

所有事件输出完毕后，输出最终结果：
[FINAL_PROB]概率数字（0-100）[/FINAL_PROB]
[FINAL_SENTIMENT]情绪指数（-100到100）[/FINAL_SENTIMENT]`

  const entitySummary = entities.map(e => ({
    id: e.id,
    name: e.name,
    role: e.role,
    category: e.category,
    position: e.position,
    strategy: e.strategy,
    agentPersona: e.agentPersona,
    ...(e.category === 'SOCIAL' ? { caseInfluence: e.caseInfluence } : {}),
  }))

  const userPrompt = `案件背景：
${caseInput}

主体设定：
${JSON.stringify(entitySummary, null, 2)}

关系网络（边数量：${graph.edges.length}）：
${graph.edges.map(e => {
  const src = entities.find(en => en.id === e.source)?.name
  const tgt = entities.find(en => en.id === e.target)?.name
  return `${src} --[${e.label}]--> ${tgt}（${e.adversarial ? '对抗' : '协作'}，强度${e.strength}）`
}).join('\n')}

请开始模拟博弈过程，逐个输出事件：`

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  })

  let full = ''
  let buffer = ''
  let currentProb = 50
  let currentSentiment = 0
  const events: GameplayEvent[] = []

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    full += text
    buffer += text

    let eventStart = buffer.indexOf('[EVENT]')
    let eventEnd = buffer.indexOf('[/EVENT]')
    while (eventStart !== -1 && eventEnd !== -1 && eventEnd > eventStart) {
      const eventJson = buffer.slice(eventStart + 7, eventEnd).trim()
      buffer = buffer.slice(eventEnd + 8)

      try {
        const event = safeParseJSON<GameplayEvent & { publicSentimentDelta?: number }>(eventJson)
        currentProb = Math.round(Math.max(0, Math.min(100, currentProb + (event.probabilityShift ?? 0))))
        currentSentiment = Math.max(-100, Math.min(100, currentSentiment + (event.publicSentimentDelta ?? 0)))
        events.push(event)
        onEvent(event, currentProb, currentSentiment)
      } catch {
        // Skip malformed event
      }

      eventStart = buffer.indexOf('[EVENT]')
      eventEnd = buffer.indexOf('[/EVENT]')
    }
  }

  const finalProbMatch = full.match(/\[FINAL_PROB\](\d+)\[\/FINAL_PROB\]/)
  const finalSentimentMatch = full.match(/\[FINAL_SENTIMENT\](-?\d+)\[\/FINAL_SENTIMENT\]/)
  if (finalProbMatch) currentProb = parseInt(finalProbMatch[1])
  if (finalSentimentMatch) currentSentiment = parseInt(finalSentimentMatch[1])

  return {
    events,
    currentPlaintiffWinProb: currentProb,
    socialInfluenceScore: currentSentiment,
  }
}

// ─── Stage 4: Generate Report ─────────────────────────────────────────────────

export async function generateReport(
  caseInput: string,
  entities: LegalEntity[],
  timeline: GameplayTimeline,
  config: LLMConfig,
  onStream?: (chunk: string) => void,
): Promise<PredictionReport> {
  const client = createClient(config)

  const systemPrompt = `你是资深法律顾问，采用 ReACT（推理-行动-观察）模式生成全面的案件走势预测报告。
输出格式：先输出 Reasoning 推理过程，再输出 Report JSON。`

  const userPrompt = `案件事实：
${caseInput}

参与主体（${entities.length} 人）：
${entities.map(e => `- ${e.name}（${e.role}）：${e.position}`).join('\n')}

博弈模拟记录（${timeline.events.length} 个事件）：
${timeline.events.map(ev => {
  const actor = entities.find(e => e.id === ev.actorId)?.name ?? ev.actorId
  return `[轮${ev.round}] ${ev.timestamp} · ${actor} · ${ev.type} · ${ev.description.slice(0, 50)}... （影响：${ev.probabilityShift > 0 ? '+' : ''}${ev.probabilityShift}%）`
}).join('\n')}

最终博弈结果：
- 原告当前胜诉概率：${timeline.currentPlaintiffWinProb}%
- 社会影响指数：${timeline.socialInfluenceScore}

请先进行 Reasoning（分析证据权重、法律适用、社会压力、博弈结果），再输出 Report JSON：

Reasoning:
[你的推理分析，3-5段]

Report:
{
  "plaintiffWinProbability": 整数（0-100，与 defendantWinProbability 之和必须等于100）,
  "defendantWinProbability": 整数（0-100，与 plaintiffWinProbability 之和必须等于100）,
  "settlementProbability": 整数（0-100，独立于胜诉概率）,
  "disputePoints": ["核心争议点1", "核心争议点2"],
  "courtJudgment": {
    "evidenceAdoption": [
      {
        "key": "证据名",
        "side": "PLAINTIFF 或 DEFENDANT",
        "weight": "CRITICAL/STRONG/MODERATE/WEAK",
        "analysis": "法院对该证据的采信分析"
      }
    ],
    "legalReasoning": "法律推理过程（从事实到结论）",
    "legalApplication": "法律条文适用分析"
  },
  "socialImpactAnalysis": "社会影响分析（2-3段）",
  "litigationStrategy": {"plaintiff": "原告诉讼策略", "defendant": "被告诉讼策略"},
  "predictedOutcome": "判决结果（详细）",
  "compensationRange": { "min": 0, "max": 0, "currency": "CNY" },
  "reasoning": "推理摘要（2-3句）"
}`

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  })

  let full = ''
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    full += text
    onStream?.(text)
  }

  const reportMatch = full.match(/Report:\s*([\s\S]+)$/i)
  if (!reportMatch) throw new Error('No Report section found in LLM output')

  return normalizeReportProbabilities(safeParseJSON<PredictionReport>(reportMatch[1]))
}

// ─── Single-agent LLM call for multi-agent engine ─────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isRetryable =
        err?.status === 429 ||
        err?.status === 500 ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT'
      if (!isRetryable || attempt === maxRetries) throw err
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30000)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

export async function chatJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  config: LLMConfig,
): Promise<T> {
  const client = createClient(config)
  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    const content = response.choices[0]?.message?.content ?? ''
    return safeParseJSON<T>(content)
  })
}
