import type {
  LLMConfig,
  LegalEntity,
  RelationshipGraph,
  RelationEdge,
  GameplayEvent,
  PredictionReport,
  Simulation,
  SimulationStage,
  AgentAction,
  JudgeDirective,
  TrialPhase,
  CreateSimulationRequest,
  ChatMessage,
} from '@shared/types'

export interface EdgeChange {
  edge: RelationEdge
  action: 'add' | 'update' | 'remove'
}

const API_BASE = '/api'

// ─── REST Helpers ─────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`后端服务未响应 (HTTP ${res.status})，请确认已用 npm run dev 同时启动前端和后端`)
  }
  let json: { success: boolean; error?: string; data?: unknown }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`服务器返回了非 JSON 响应 (HTTP ${res.status})，请检查后端是否正常运行`)
  }
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export async function saveConfig(config: LLMConfig): Promise<void> {
  await request('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function getConfig(): Promise<{ apiBase: string; model: string; hasKey: boolean }> {
  return request('/config')
}

export async function createSimulation(payload: CreateSimulationRequest): Promise<string> {
  const data = await request<{ simulationId: string }>('/simulations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.simulationId
}

export async function getSimulation(id: string): Promise<Simulation> {
  return request(`/simulations/${id}`)
}

export async function listSimulations(): Promise<Pick<Simulation, 'id' | 'projectName' | 'caseInput' | 'caseSummary' | 'roundCount' | 'status' | 'stage' | 'createdAt'>[]> {
  return request('/simulations')
}

export async function deleteSimulation(id: string): Promise<void> {
  await request(`/simulations/${id}`, { method: 'DELETE' })
}

export async function resumeSimulation(id: string): Promise<void> {
  await request(`/simulations/${id}/resume`, { method: 'POST' })
}

// ─── SSE Helper ───────────────────────────────────────────────────────────────

export interface SimulationSSEHandlers {
  onStageStart?: (stage: SimulationStage, label: string) => void
  onStageChunk?: (stage: SimulationStage, text: string) => void
  onStageComplete?: (stage: SimulationStage) => void
  onStageError?: (stage: SimulationStage, error: string) => void
  onCaseSummary?: (summary: string) => void
  onEntities?: (entities: LegalEntity[]) => void
  onGraph?: (graph: RelationshipGraph) => void
  onRoundStart?: (round: number, activeAgents: string[], phase?: TrialPhase, activeDirectives?: JudgeDirective[]) => void
  onGraphUpdate?: (round: number, changes: EdgeChange[]) => void
  onAgentThinking?: (agentId: string, agentName: string) => void
  onAgentAction?: (agentId: string, agentName: string, action: AgentAction) => void
  onEventResolved?: (event: GameplayEvent, prob: number, sentiment: number) => void
  onRoundComplete?: (round: number, prob: number, sentiment: number) => void
  onReportChunk?: (text: string) => void
  onReportComplete?: (report: PredictionReport) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

export function subscribeToSimulation(
  simulationId: string,
  handlers: SimulationSSEHandlers,
): () => void {
  const es = new EventSource(`${API_BASE}/simulations/${simulationId}/stream`)

  es.addEventListener('stage:start', (e) => {
    const d = JSON.parse(e.data)
    handlers.onStageStart?.(d.stage as SimulationStage, d.label)
  })

  es.addEventListener('stage:chunk', (e) => {
    const d = JSON.parse(e.data)
    handlers.onStageChunk?.(d.stage as SimulationStage, d.text)
  })

  es.addEventListener('stage:complete', (e) => {
    const d = JSON.parse(e.data)
    handlers.onStageComplete?.(d.stage as SimulationStage)
  })

  es.addEventListener('stage:error', (e) => {
    const d = JSON.parse(e.data)
    handlers.onStageError?.(d.stage as SimulationStage, d.error)
  })

  es.addEventListener('case:summary', (e) => {
    const d = JSON.parse(e.data)
    handlers.onCaseSummary?.(d.summary)
  })

  es.addEventListener('entity:batch', (e) => {
    const d = JSON.parse(e.data)
    handlers.onEntities?.(d.entities)
  })

  es.addEventListener('graph:complete', (e) => {
    const d = JSON.parse(e.data)
    handlers.onGraph?.(d.graph)
  })

  es.addEventListener('round:start', (e) => {
    const d = JSON.parse(e.data)
    handlers.onRoundStart?.(d.round, d.activeAgents, d.phase, d.activeDirectives)
  })

  es.addEventListener('graph:update', (e) => {
    const d = JSON.parse(e.data)
    handlers.onGraphUpdate?.(d.round, d.changes)
  })

  es.addEventListener('agent:thinking', (e) => {
    const d = JSON.parse(e.data)
    handlers.onAgentThinking?.(d.agentId, d.agentName)
  })

  es.addEventListener('agent:action', (e) => {
    const d = JSON.parse(e.data)
    handlers.onAgentAction?.(d.agentId, d.agentName, d.action)
  })

  es.addEventListener('event:resolved', (e) => {
    const d = JSON.parse(e.data)
    handlers.onEventResolved?.(d.event, d.newProb, d.newSentiment)
  })

  es.addEventListener('round:complete', (e) => {
    const d = JSON.parse(e.data)
    handlers.onRoundComplete?.(d.round, d.prob, d.sentiment)
  })
  es.addEventListener('report:complete', (e) => {
    const d = JSON.parse(e.data)
    handlers.onReportComplete?.(d.report)
  })

  es.addEventListener('simulation:complete', () => {
    handlers.onComplete?.()
    es.close()
  })

  es.addEventListener('error', (e) => {
    if (e instanceof MessageEvent && e.data) {
      try {
        const d = JSON.parse(e.data)
        handlers.onError?.(d.error)
      } catch {
        handlers.onError?.('Connection error')
      }
    } else {
      handlers.onError?.('Connection error')
    }
    es.close()
  })

  return () => es.close()
}

// ─── Agent Chat ───────────────────────────────────────────────────────────────

export { type ChatMessage }

/**
 * Stream a chat response from a simulation agent.
 * Returns an abort function to cancel the request.
 */
export function chatWithAgent(
  simulationId: string,
  entityId: string,
  messages: ChatMessage[],
  lang: 'zh' | 'en',
  onChunk: (text: string) => void,
  onDone: () => void,
  onError?: (error: string) => void,
): () => void {
  const controller = new AbortController()

  fetch(`${API_BASE}/chat/${simulationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityId, messages, lang }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => 'Request failed')
      onError?.(text)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') { onDone(); return }
        if (data.startsWith('[ERROR]')) { onError?.(data.slice(7).trim()); return }
        try { onChunk(JSON.parse(data)) } catch { /* ignore */ }
      }
    }

    onDone()
  }).catch((err: Error) => {
    if (err.name !== 'AbortError') onError?.(err.message)
  })

  return () => controller.abort()
}
