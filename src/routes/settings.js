import { Router } from 'express'
import { z } from 'zod'
import { Settings, getSettings } from '../models/Settings.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { gateway } from '../services/gateway.js'
import { ah, parse } from '../utils.js'

const router = Router()

const str = (max = 500) => z.string().trim().max(max)

const updateSchema = z
  .object({
    name: str(80).min(1),
    tagline: str(160),
    about: str(1000),
    address: str(200),
    phone: str(40),
    whatsapp: str(20),
    hours: str(120),
    currency: str(10),
    acceptingOrders: z.boolean(),
    deliveryFee: z.coerce.number().min(0).max(100000),
    minOrder: z.coerce.number().min(0).max(1000000),
    taxName: str(40),
    taxRate: z.coerce.number().min(0).max(50),
    maxCashierDiscount: z.coerce.number().min(0).max(100),
    taxNumber: str(60),
    receiptFooter: str(200),
    codEnabled: z.boolean(),
    easypaisaEnabled: z.boolean(),
    easypaisaNumber: str(40),
    easypaisaTitle: str(80),
    jazzcashNumber: str(40),
    jazzcashTitle: str(80),
    bankEnabled: z.boolean(),
    bankDetails: str(500),
  })
  .partial()

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ ...(await getSettings()), gateways: gateway.available(), onlinePaymentEnabled: gateway.enabled() })
  }),
)

router.put(
  '/',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const data = parse(updateSchema, req.body)
    await getSettings()
    await Settings.updateOne({ key: 'store' }, { $set: data })
    res.json(await getSettings())
  }),
)

export default router
