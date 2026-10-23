import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { config } from './config.js'
import { User } from './models/User.js'
import { getSettings } from './models/Settings.js'

mongoose.set('strictQuery', true)

async function ensureAdmin() {
  if (await User.estimatedDocumentCount()) return
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('No users exist yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.')
    return
  }
  await User.create({
    name: config.adminName,
    email: config.adminEmail,
    role: 'admin',
    passwordHash: await bcrypt.hash(config.adminPassword, 10),
  })
  console.log(`Created first admin: ${config.adminEmail}`)
}

// One shared connection promise. On Vercel the function instance is reused between requests ("warm"),
// so this connects once per instance instead of once per request. If connecting fails, the next request retries.
let ready
export function connectDb() {
  if (!ready) {
    ready = (async () => {
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      await getSettings()
      await ensureAdmin()
    })().catch((err) => {
      ready = undefined
      throw err
    })
  }
  return ready
}
