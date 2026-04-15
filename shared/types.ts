// ─── Entity Types ──────────────────────────────────────────────────────────────

export type EntityRole =
  // Court Participants / 诉讼主体
  | 'PLAINTIFF'
  | 'DEFENDANT'
  | 'PLAINTIFF_LAWYER'
  | 'DEFENDANT_LAWYER'
  | 'JUDGE'
  | 'WITNESS'
  // Social Stakeholders / 社会影响方
  | 'PUBLIC_STAKEHOLDER'
  | 'ONLINE_INFLUENCER'
  | 'LEGISLATOR'
  | 'GOVERNMENT_AGENCY'
  | 'MEDIA_OUTLET'
  | 'EXPERT_COMMENTATOR'
  | 'ADVOCACY_GROUP'

// 律师诉讼策略模式
export type LawyerStrategyMode =
  | 'AGGRESSIVE_DISCOVERY'     // 激进取证：大量举证与交叉询问
  | 'PROCEDURAL_OBSTRUCTION'   // 程序阻击：多提程序异议，消耗对方
  | 'SETTLEMENT_ORIENTED'      // 和解导向：早期推动和解
  | 'NARRATIVE_FRAMING'        // 叙事建构：通过舆论塑造案件形象
  | 'LEGAL_TECHNICALITY'       // 法律技术：专注法条漏洞与程序性进攻

// 证据类型分级（用于效力计算）
export type EvidenceCategory =
  | 'DIRECT'          // 直接证据（书证/物证/视听资料/电子数据）
  | 'EXPERT'          // 专家意见/鉴定意见
  | 'WITNESS'         // 普通证人证词
  | 'CIRCUMSTANTIAL'  // 间接证据/情况证据
  | 'HEARSAY'         // 传闻证据

export type EntityCategory = 'COURT' | 'SOCIAL'

export interface LegalEntity {
  id: string
  name: string
  role: EntityRole
  category: EntityCategory
  supportsPlaintiff?: boolean
  position: string        // 立场描述
  interests: string[]     // 利益诉求
  strategy: string        // 行动策略
  agentPersona: string    // LLM 生成的 Agent 人格设定
  // Social-specific
  followerScale?: 'INDIVIDUAL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE'
  caseInfluence?: number     // 0-100，案件综合影响力（SOCIAL 主体专用）
  // Lawyer-specific
  lawyerStrategy?: LawyerStrategyMode  // 律师诉讼策略模式（仅律师角色）
}

// ─── Relationship Graph ────────────────────────────────────────────────────────

export type RelationType =
  | 'LITIGATION'
  | 'INTEREST_ALIGN'
  | 'EVIDENCE_LINK'
  | 'REPRESENT'
  | 'WITNESS_FOR'
  | 'MEDIA_COVERAGE'
  | 'POLITICAL_PRESSURE'
  | 'PUBLIC_SUPPORT'
  | 'PUBLIC_OPPOSITION'
  | 'REGULATORY_OVERSIGHT'

export interface RelationEdge {
  id: string
  source: string
  target: string
  type: RelationType
  label: string
  strength: number      // 0-1
  adversarial: boolean
}

export interface RelationshipGraph {
  nodes: LegalEntity[]
  edges: RelationEdge[]
}

// ─── Gameplay Timeline ────────────────────────────────────────────────────────

export type ProceedingType =
  // In-court
  | 'EVIDENCE_SUBMISSION'
  | 'CROSS_EXAMINATION'
  | 'ORAL_ARGUMENT'
  | 'SETTLEMENT_OFFER'
  | 'JUDICIAL_RULING'
  | 'WITNESS_TESTIMONY'
  // Out-of-court (social stakeholders)
  | 'MEDIA_REPORT'
  | 'SOCIAL_POST'
  | 'LEGISLATIVE_MOTION'
  | 'GOVT_STATEMENT'
  | 'PUBLIC_PROTEST'
  | 'EXPERT_OPINION'

export interface GameplayEvent {
  id: string
  round: number
  timestamp: string
  type: ProceedingType
  actorId: string
  targetId?: string
  description: string
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'  // relative to plaintiff
  probabilityShift: number       // -20 ~ +20
  publicSentimentDelta?: number  // only for social events
  evidenceCategory?: EvidenceCategory  // 证据类型（EVIDENCE_SUBMISSION/WITNESS_TESTIMONY 时有效）
  evidenceWeightMultiplier?: number    // 证据效力倍数（由 evidenceCategory 决定）
}

export interface GameplayTimeline {
  events: GameplayEvent[]
  currentPlaintiffWinProb: number
  socialInfluenceScore: number   // -100 ~ 100
}

// ─── Prediction Report ────────────────────────────────────────────────────────

export interface EvidenceAnalysis {
  key: string
  side: 'PLAINTIFF' | 'DEFENDANT'
  weight: 'CRITICAL' | 'STRONG' | 'MODERATE' | 'WEAK'
  analysis: string
  roundRef?: number  // 引用具体轮次
}

export interface CourtJudgmentAnalysis {
  evidenceAdoption: EvidenceAnalysis[]   // 证据采信
  judicialAnalysis: string               // 判决说理（法律推理与法律适用合并，模拟法官 IRAC 框架）
  citedStatutes?: Array<{ code: string; relevance: string }>  // 引用法条
  keyFactFindings?: string[]              // 关键事实认定
}

// 诉讼请求维度概率拆解（#10）
export interface OutcomeProbabilities {
  overall: number           // 整体胜诉率（与 plaintiffWinProbability 同值）
  fullSupport: number       // 全部诉请被支持概率
  partialSupport: number    // 部分支持概率（最常见）
  coreClaimSupport: number  // 核心诉请被支持概率
  settlementLikelihood: number  // 和解概率
  compensationEstimate?: { low: number; mid: number; high: number; currency: string }
}

// 举证责任状态（#4）
export interface BurdenOfProofState {
  currentBearingParty: 'PLAINTIFF' | 'DEFENDANT' | 'SHARED'
  standardMet: boolean     // 当前承担方是否已达到证明标准
  standardThreshold: number  // 证明标准阈值（民事 0.51，刑事 0.90）
  lastShiftRound?: number  // 上次举证责任转移的轮次
  reason?: string          // 转移原因
}

export interface PredictionReport {
  plaintiffWinProbability: number
  defendantWinProbability: number
  settlementProbability: number
  disputePoints: string[]
  courtJudgment: CourtJudgmentAnalysis
  socialImpactAnalysis: string
  litigationStrategy: { plaintiff: string; defendant: string }
  predictedOutcome: string
  compensationRange?: { min: number; max: number; currency: string }
  reasoning: string
  relationshipEvolution?: string
  phaseAnalysis?: { phase: TrialPhase; summary: string }[]
  // #10 新增：诉讼请求维度拆解
  outcomeProbabilities?: OutcomeProbabilities
  // 新增：执行风险与上诉风险
  enforcementRisk?: string
  appealRisk?: string
}

// ─── Trial Phase ─────────────────────────────────────────────────────────────

export type TrialPhase = 'OPENING' | 'EVIDENCE' | 'DEBATE' | 'CLOSING'

// ─── Judge Directives ────────────────────────────────────────────────────────

export type DirectiveType = 'REQUIRE_EVIDENCE' | 'LIMIT_ACTION' | 'ORDER_TESTIMONY' | 'GRANT_SETTLEMENT_WINDOW'

export interface JudgeDirective {
  id: string
  round: number
  directiveType: DirectiveType
  targetAgentId?: string
  description: string
  expiresRound: number
}

// ─── Simulation State Machine ─────────────────────────────────────────────────

export type SimulationStage = 0 | 1 | 2 | 3 | 4
export type StageStatus = 'idle' | 'loading' | 'done' | 'error'

export interface SimulationState {
  simulationId: string | null
  stage: SimulationStage
  stageStatuses: Record<number, StageStatus>
  caseInput: string
  roundCount: number
  entities: LegalEntity[]
  graph: RelationshipGraph | null
  timeline: GameplayTimeline | null
  report: PredictionReport | null
  caseSummary: string
  streamingText: string
  error: string | null
  currentPhase: TrialPhase | null
  activeDirectives: JudgeDirective[]
}

// ─── LLM Config ───────────────────────────────────────────────────────────────

export interface LLMConfig {
  apiKey: string
  apiBase: string
  model: string
  zepApiKey?: string
  /** Detected language of the case input — set automatically by the simulation pipeline. */
  caseLanguage?: 'zh' | 'en'
}

// ─── Backend-specific Types ───────────────────────────────────────────────────

export type SimulationStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed'

export interface Simulation {
  id: string
  projectName?: string
  caseInput: string
  caseSummary?: string
  fileContent?: string
  fileName?: string
  roundCount: number
  status: SimulationStatus
  stage: SimulationStage
  stageStatuses: Record<number, StageStatus>
  entities: LegalEntity[]
  graph: RelationshipGraph | null
  timeline: GameplayTimeline | null
  report: PredictionReport | null
  error: string | null
  createdAt: string
  updatedAt: string
}

// ─── Agent Chat ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Multi-Agent Engine Types ─────────────────────────────────────────────────

export interface AgentMemory {
  observations: string[]
  ownActions: AgentAction[]
  roundSummaries: string[]
  compressedHistory: string
}

export interface AgentAction {
  agentId: string
  round: number
  actionType: ProceedingType
  targetId?: string
  reasoning: string
  description: string
  intensity: number   // 0-1
  directive?: {
    directiveType: DirectiveType
    targetAgentId?: string
    description: string
    duration?: number
  }
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType =
  | 'simulation:started'
  | 'stage:start'
  | 'stage:chunk'
  | 'stage:complete'
  | 'stage:error'
  | 'entity:batch'
  | 'graph:complete'
  | 'round:start'
  | 'agent:thinking'
  | 'agent:action'
  | 'event:resolved'
  | 'round:complete'
  | 'report:chunk'
  | 'report:complete'
  | 'graph:update'
  | 'case:summary'
  | 'simulation:complete'
  | 'error'

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface CreateSimulationRequest {
  projectName?: string
  caseInput: string
  roundCount: number
  fileContent?: string
  fileName?: string
}

export interface CreateSimulationResponse {
  simulationId: string
}

