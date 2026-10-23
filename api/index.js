// Vercel serverless entry point: every request (see vercel.json) is handled by the Express app.
import { createApp } from '../src/app.js'
import { connectDb } from '../src/db.js'

const app = createApp()

export default async function handler(req, res) {
  try {
    await connectDb()
  } catch (err) {
    console.error('Database connection failed:', err.message)
    return res.status(503).json({ error: 'Database is not reachable. Check MONGODB_URI and Atlas network access.' })
  }
  return app(req, res)
}
