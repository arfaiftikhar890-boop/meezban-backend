import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { User } from '../models/User.js'
import { ah } from '../utils.js'

export const requireAuth = ah(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Please log in.' })

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }

  const user = await User.findById(payload.sub)
  if (!user || !user.active) return res.status(401).json({ error: 'This account is not active.' })
  req.user = user
  next()
})

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only the admin can do this.' })
  next()
}
