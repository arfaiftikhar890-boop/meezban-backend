// Local / traditional hosting entry point (npm start). On Vercel the entry point is api/index.js instead.
import { config } from './config.js'
import { createApp } from './app.js'
import { connectDb } from './db.js'

connectDb()
  .then(() => {
    console.log('MongoDB connected')
    createApp().listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`))
  })
  .catch((err) => {
    console.error('Failed to start:', err.message)
    process.exit(1)
  })
