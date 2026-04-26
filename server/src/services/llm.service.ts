import OpenAI from 'openai'
import type {
  LLMConfig,
  LegalEntity,
  RelationEdge,
  PredictionReport,
  RelationshipGraph,
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
