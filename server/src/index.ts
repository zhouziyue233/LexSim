import { mkdirSync } from 'node:fs'
import { config } from './config.js'
import { createApp } from './app.js'
import { initDatabase } from './services/persistence.service.js'

// Ensure data directory exists
mkdirSync(config.dataDir, { recursive: true })

// Initialize SQLite
initDatabase()
console.log('[DB] SQLite initialized at', config.dbPath)

// Start Express
const app = createApp()
app.listen(config.port, () => {
  console.log(`[Server] LegalSim backend listening on http://localhost:${config.port}`)
})
