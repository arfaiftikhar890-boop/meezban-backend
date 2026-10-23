import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { config } from './config.js'
import { HttpError } from './utils.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import menuRoutes from './routes/menu.js'
import settingsRoutes from './routes/settings.js'
import orderRoutes from './routes/orders.js'
import reportRoutes from './routes/reports.js'
import paymentRoutes from './routes/payments.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()
  app.set('trust proxy', 1) // behind Render/Railway/Nginx, so rate limits see the real IP

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  )
  if (config.clientOrigin) app.use(cors({ origin: config.clientOrigin.split(',') }))
  if (!process.env.NO_LOG) app.use(morgan(config.isProd ? 'combined' : 'dev'))
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }))
  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/menu', menuRoutes)
  app.use('/api/settings', settingsRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/reports', reportRoutes)
  app.use('/api/payments', paymentRoutes)
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

  // Serve the built React app (client/dist) from the same server in production.
  const dist = path.resolve(__dirname, '../../client/dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    if (err?.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 1.5 MB).' : err.message })
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' })
    if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: err.message })
    if (err?.code === 11000) return res.status(409).json({ error: 'That already exists.' })
    console.error(err)
    res.status(500).json({ error: 'Something went wrong on the server.' })
  })

  return app
}
