import { Router } from 'express'
import { z } from 'zod'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateBody } from '../middleware/validateBody.js'
import type { LLMConfig } from '@shared/types'

const router = Router()

const __dirname = dirname(fileURLToPath(import.meta.url))
// server/src/routes/ → ../../  = server/
const ENV_PATH = resolve(__dirname, '..', '..', '.env')

// ─── Persist to .env ──────────────────────────────────────────────────────────

function writeEnvFile(cfg: LLMConfig): void {
  const lines: string[] = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, 'utf-8').split('\n').filter(l => l !== '')
    : []

  const updates: Record<string, string> = {
    LLM_API_KEY:  cfg.apiKey,
    LLM_API_BASE: cfg.apiBase,
    LLM_MODEL:    cfg.model,
    ZEP_API_KEY:  cfg.zepApiKey ?? '',
  }

  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex(l => l.startsWith(`${key}=`))
    if (value) {
      const line = `${key}=${value}`
      if (idx >= 0) lines[idx] = line
      else lines.push(line)
    } else if (idx >= 0) {
      lines.splice(idx, 1)
    }
  }

  writeFileSync(ENV_PATH, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8')
}

// ─── In-memory config (initialized from .env via dotenv in config.ts) ────────

let llmConfig: LLMConfig = {
  apiKey:    process.env.LLM_API_KEY  ?? '',
  apiBase:   process.env.LLM_API_BASE ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model:     process.env.LLM_MODEL    ?? 'qwen-plus',
  zepApiKey: process.env.ZEP_API_KEY  || undefined,
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const configSchema = z.object({
  apiKey:    z.string().min(1, 'API Key is required'),
  apiBase:   z.string().url('Invalid API Base URL'),
  model:     z.string().min(1, 'Model name is required'),
  zepApiKey: z.string().optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/config — Save LLM config and persist to server/.env */
router.post('/', validateBody(configSchema), (req, res) => {
  llmConfig = req.body as LLMConfig
  try {
    writeEnvFile(llmConfig)
  } catch (err) {
    console.warn('[Config] Failed to write .env:', err)
  }
  res.json({ success: true })
})

/** GET /api/config — Return config with key masked */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      apiBase: llmConfig.apiBase,
      model:   llmConfig.model,
      hasKey:  llmConfig.apiKey.length > 0,
    },
  })
})

/** Internal: get full config (not exposed via HTTP) */
export function getLLMConfig(): LLMConfig {
  return { ...llmConfig }
}

export default router
