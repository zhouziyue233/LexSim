import { configDotenv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load server/.env before any other module reads process.env
configDotenv({ path: path.resolve(__dirname, '..', '.env') })

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  dataDir: path.resolve(__dirname, '..', 'data'),
  dbPath: path.resolve(__dirname, '..', 'data', 'legalsim.db'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Max concurrent LLM calls per simulation round */
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY ?? '5', 10),
  /** Agent LLM call timeout in ms */
  agentTimeout: parseInt(process.env.AGENT_TIMEOUT ?? '60000', 10),
}
