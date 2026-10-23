import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, HttpError, parse } from '../utils.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

router.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body)
    const user = await User.findOne({ email })
    const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash))
    if (!ok) throw new HttpError(401, 'Wrong email or password.')
    const token = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpires })
    res.json({ token, user })
  }),
)

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }))

const pwSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, 'New password must be at least 8 characters'),
})

router.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const { current, next } = parse(pwSchema, req.body)
    if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new HttpError(400, 'Current password is wrong.')
    req.user.passwordHash = await bcrypt.hash(next, 10)
    await req.user.save()
    res.json({ ok: true })
  }),
)

export default router
