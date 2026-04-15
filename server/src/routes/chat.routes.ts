import { Router } from 'express'
import { z } from 'zod'
import OpenAI from 'openai'
import { validateBody } from '../middleware/validateBody.js'
import { getLLMConfig } from './config.routes.js'
import { persistence } from '../services/persistence.service.js'
import type { LegalEntity, GameplayEvent } from '@shared/types'

const router = Router()

// ─── Role name mapping ────────────────────────────────────────────────────────

const ROLE_NAMES: Record<string, { zh: string; en: string }> = {
  PLAINTIFF:          { zh: '原告',         en: 'Plaintiff' },
  DEFENDANT:          { zh: '被告',         en: 'Defendant' },
  PLAINTIFF_LAWYER:   { zh: '原告律师',     en: "Plaintiff's Counsel" },
  DEFENDANT_LAWYER:   { zh: '被告律师',     en: 'Defense Counsel' },
  JUDGE:              { zh: '法官',         en: 'Judge' },
  WITNESS:            { zh: '证人',         en: 'Witness' },
  PUBLIC_STAKEHOLDER: { zh: '公众利益方',   en: 'Public Stakeholder' },
  ONLINE_INFLUENCER:  { zh: '网络意见领袖', en: 'KOL / Influencer' },
  LEGISLATOR:         { zh: '立法者',       en: 'Legislator' },
  GOVERNMENT_AGENCY:  { zh: '政府机构',     en: 'Government Agency' },
  MEDIA_OUTLET:       { zh: '媒体机构',     en: 'Media Outlet' },
  EXPERT_COMMENTATOR: { zh: '专家评论员',   en: 'Expert / Scholar' },
  ADVOCACY_GROUP:     { zh: 'NGO/倡导团体', en: 'NGO / Advocacy Group' },
}

// ─── System prompt builders ───────────────────────────────────────────────────

function buildSystemPromptZH(
  entity: LegalEntity,
  caseSummary: string,
  events: GameplayEvent[],
  roleName: string,
): string {
  const eventsText = events.length > 0
    ? events.map(e => `第${e.round}轮 [${e.type}]：${e.description}`).join('\n')
    : '（本次模拟中暂无你的行动记录）'

  return `你是 ${entity.name}，在以下法律案件的多智能体模拟中扮演${roleName}。

【案件背景】
${caseSummary}

【你的角色设定】
立场：${entity.position}
核心利益：${entity.interests.join('；')}
行动策略：${entity.strategy}
人格特质：${entity.agentPersona}

【你在模拟中的行动记录】
${eventsText}

请完全代入这个角色，用第一人称诚实回答用户的问题。基于以上真实的模拟记录，解释你行为背后的动机、想法与内心感受，保持角色一致性。如果用户询问模拟中未涉及的内容，请基于你的角色设定进行合理推断。回答应当真实、有深度，反映出这个角色真实的立场与利益考量。`
}

function buildSystemPromptEN(
  entity: LegalEntity,
  caseSummary: string,
  events: GameplayEvent[],
  roleName: string,
): string {
  const eventsText = events.length > 0
    ? events.map(e => `Round ${e.round} [${e.type}]: ${e.description}`).join('\n')
    : '(No recorded actions in this simulation)'

  return `You are ${entity.name}, playing the role of ${roleName} in a multi-agent legal simulation of the following case.

[Case Background]
${caseSummary}

[Your Character Profile]
Position: ${entity.position}
Core Interests: ${entity.interests.join('; ')}
Behavioral Strategy: ${entity.strategy}
Personality: ${entity.agentPersona}

[Your Actions in the Simulation]
${eventsText}

Please fully embody this role and answer the user's questions in first person. Based on the actual simulation records above, explain the motivations, thoughts, and inner feelings behind your actions, maintaining character consistency. If the user asks about something not covered in the simulation, make reasonable inferences based on your character profile. Your answers should be genuine and insightful, reflecting this character's true position and interests.`
}

// ─── Request schema ───────────────────────────────────────────────────────────

const chatSchema = z.object({
  entityId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  lang: z.enum(['zh', 'en']).default('zh'),
})

// ─── POST /api/chat/:simulationId ─────────────────────────────────────────────

router.post('/:simulationId', validateBody(chatSchema), async (req, res) => {
  const simulationId = req.params.simulationId as string
  const { entityId, messages, lang } = req.body as z.infer<typeof chatSchema>

  const sim = persistence.getSimulation(simulationId)
  if (!sim) {
    return res.status(404).json({ success: false, error: 'Simulation not found' })
  }

  const entity = sim.entities.find(e => e.id === entityId)
  if (!entity) {
    return res.status(404).json({ success: false, error: 'Entity not found' })
  }

  // Filter this entity's actions from the timeline (max 30)
  const events = (sim.timeline?.events ?? [])
    .filter(e => e.actorId === entityId)
    .slice(0, 30)

  const roleName = ROLE_NAMES[entity.role]?.[lang] ?? entity.role
  const systemPrompt = lang === 'zh'
    ? buildSystemPromptZH(entity, sim.caseSummary ?? sim.caseInput, events, roleName)
    : buildSystemPromptEN(entity, sim.caseSummary ?? sim.caseInput, events, roleName)

  // Setup SSE streaming response
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const llmConfig = getLLMConfig()
    const client = new OpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.apiBase })

    const stream = await client.chat.completions.create({
      model: llmConfig.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        res.write(`data: ${JSON.stringify(text)}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    const msg = err?.message ?? 'Chat failed'
    res.write(`data: [ERROR] ${msg}\n\n`)
    res.end()
  }
})

export default router
