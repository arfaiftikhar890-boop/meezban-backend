import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { User } from '../models/User.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { ah, checkId, HttpError, parse } from '../utils.js'

const router = Router()
router.use(requireAuth, requireAdmin)

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'cashier']).default('cashier'),
})

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['admin', 'cashier']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

router.get(
  '/',
  ah(async (req, res) => {
    res.json(await User.find().sort({ createdAt: 1 }))
  }),
)

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(createSchema, req.body)
    if (await User.exists({ email: d.email })) throw new HttpError(409, 'A user with this email already exists.')
    const user = await User.create({ name: d.name, email: d.email, role: d.role, passwordHash: await bcrypt.hash(d.password, 10) })
    res.status(201).json(user)
  }),
)

router.patch(
  '/:id',
  ah(async (req, res) => {
    checkId(req.params.id)
    const d = parse(updateSchema, req.body)
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found.')

    const isSelf = String(user._id) === String(req.user._id)
    if (isSelf && (d.active === false || (d.role && d.role !== 'admin')))
      throw new HttpError(400, 'You cannot deactivate or demote your own account.')

    if (d.name !== undefined) user.name = d.name
    if (d.role !== undefined) user.role = d.role
    if (d.active !== undefined) user.active = d.active
    if (d.password) user.passwordHash = await bcrypt.hash(d.password, 10)
    await user.save()
    res.json(user)
  }),
)

export default router
