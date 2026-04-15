import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import configRoutes from './routes/config.routes.js'
import simulationRoutes from './routes/simulation.routes.js'
import chatRoutes from './routes/chat.routes.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json({ limit: '10mb' }))

  // Routes
  app.use('/api/config', configRoutes)
  app.use('/api/simulations', simulationRoutes)
  app.use('/api/chat', chatRoutes)

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'LegalSim server running' })
  })

  // Error handler (must be last)
  app.use(errorHandler)

  return app
}
