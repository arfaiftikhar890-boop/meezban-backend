
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { Order } from '../models/Order.js'
import { getSettings } from '../models/Settings.js'
import { requireAuth } from '../middleware/auth.js'
import { placeOrder } from '../services/billing.js'
import { gateway } from '../services/gateway.js'
import { createReceiptPdf } from '../services/receiptPdf.js'
import { sendOrderEmail, notifyAdmin } from '../services/mailer.js'
import { ah, checkId, HttpError, parse } from '../utils.js'

const router = Router()

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many orders from this connection. Please call us to place your order.',
  },
})

const lines = z
  .array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid item'),
      qty: z.coerce.number().int().min(1).max(50),
    }),
  )
  .min(1, 'Your cart is empty')
  .max(50)

const pkPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s\-()]/g, ''))
  .refine(
    (s) => /^(\+?92|0)?3\d{9}$/.test(s),
    'Enter a valid mobile number, e.g. 0300 1234567',
  )

/* ------------------------------ public ------------------------------ */

const publicSchema = z
  .object({
    orderType: z.enum(['delivery', 'pickup']),
    customer: z.object({
      name: z.string().trim().min(2, 'Enter your name').max(100),
      phone: pkPhone,
      email: z.string().trim().max(120).optional().default(''),
      address: z.string().trim().max(300).optional().default(''),
    }),
    items: lines,
    notes: z.string().trim().max(500).optional().default(''),
    paymentMethod: z.enum([
      'cod',
      'wallet',
      'bank',
      'jazzcash',
      'easypaisa',
    ]),
    paymentRef: z
      .object({
        tid: z.string().trim().max(60).optional().default(''),
        sender: z.string().trim().max(30).optional().default(''),
      })
      .optional()
      .default({ tid: '', sender: '' }),
  })
  .superRefine((d, ctx) => {
    if (d.orderType === 'delivery' && d.customer.address.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'address'],
        message: 'Enter your full delivery address',
      })
    }

    if (
      (d.paymentMethod === 'wallet' || d.paymentMethod === 'bank') &&
      d.paymentRef.tid.length < 6
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentRef', 'tid'],
        message: 'Enter the transaction ID (TID) of your payment',
      })
    }
  })

router.post(
  '/',
  orderLimiter,
  ah(async (req, res) => {
    const d = parse(publicSchema, req.body)
    const settings = await getSettings()

    if (!settings.acceptingOrders) {
      throw new HttpError(400, 'We are not taking online orders right now.')
    }

    if (d.paymentMethod === 'cod' && !settings.codEnabled) {
      throw new HttpError(400, 'Cash on delivery is not available.')
    }

    if (d.paymentMethod === 'wallet' && !settings.easypaisaEnabled) {
      throw new HttpError(400, 'This payment method is not available.')
    }

    if (d.paymentMethod === 'bank' && !settings.bankEnabled) {
      throw new HttpError(400, 'This payment method is not available.')
    }

    if (
      (d.paymentMethod === 'jazzcash' ||
        d.paymentMethod === 'easypaisa') &&
      !gateway[d.paymentMethod].enabled()
    ) {
      throw new HttpError(400, 'This payment method is not available.')
    }

    const order = await placeOrder({
      source: 'online',
      orderType: d.orderType,
      lines: d.items,
      customer: {
        name: d.customer.name,
        email: d.customer.email,
        phone: d.customer.phone,
        address:
          d.orderType === 'delivery' ? d.customer.address : '',
      },
      notes: d.notes,
      payment: {
        method: d.paymentMethod,
        status: ['wallet', 'bank'].includes(d.paymentMethod)
          ? 'verification'
          : 'unpaid',
        tid: d.paymentRef.tid,
        sender: d.paymentRef.sender,
      },
      settings,
    })

    await sendOrderEmail(order, settings, 'placed')
    await notifyAdmin(order, settings)

    res.status(201).json({
      publicId: order.publicId,
      invoiceNo: order.invoiceNo,
    })
  }),
)

// Public order status page
router.get(
  '/public/:publicId',
  ah(async (req, res) => {
    const o = await Order.findOne({ publicId: req.params.publicId })

    if (!o) {
      throw new HttpError(404, 'Order not found.')
    }

    res.json({
      invoiceNo: o.invoiceNo,
      orderType: o.orderType,
      status: o.status,
      items: o.items,
      subtotal: o.subtotal,
      discount: o.discount,
      taxRate: o.taxRate,
      tax: o.tax,
      deliveryFee: o.deliveryFee,
      total: o.total,
      payment: {
        method: o.payment.method,
        status: o.payment.status,
        tid: o.payment.tid,
        message: o.payment.gatewayMessage,
      },
      customer: {
        name: o.customer.name,
        address: o.customer.address,
      },
      notes: o.notes,
      createdAt: o.createdAt,
    })
  }),
)

/* ------------------------------- staff ------------------------------ */

router.use(requireAuth)

const posSchema = z
  .object({
    orderType: z.enum(['dinein', 'takeaway', 'delivery']),
    table: z.string().trim().max(20).optional().default(''),
    customer: z
      .object({
        name: z.string().trim().max(100).optional().default(''),
        phone: z.string().trim().max(20).optional().default(''),
        address: z.string().trim().max(300).optional().default(''),
      })
      .optional()
      .default({ name: '', phone: '', address: '' }),
    items: lines,
    discount: z
      .object({
        kind: z.enum(['none', 'percent', 'amount']).default('none'),
        value: z.coerce.number().min(0).max(10000000).default(0),
      })
      .optional()
      .default({ kind: 'none', value: 0 }),
    notes: z.string().trim().max(500).optional().default(''),
    payNow: z.boolean().optional().default(true),
    payment: z
      .object({
        method: z.enum(['cash', 'card', 'wallet', 'bank']).default('cash'),
        received: z.coerce.number().min(0).optional(),
        tid: z.string().trim().max(60).optional().default(''),
      })
      .optional()
      .default({ method: 'cash', tid: '' }),
  })
  .superRefine((d, ctx) => {
    if (
      d.orderType === 'delivery' &&
      (d.customer.address.length < 5 || d.customer.phone.length < 7)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['customer'],
        message: 'Delivery orders need the customer phone and address',
      })
    }
  })

router.post(
  '/pos',
  ah(async (req, res) => {
    const d = parse(posSchema, req.body)
    const settings = await getSettings()
    const paid = d.payNow

    const order = await placeOrder({
      source: 'pos',
      orderType: d.orderType,
      lines: d.items,
      customer: d.customer,
      table: d.orderType === 'dinein' ? d.table : '',
      notes: d.notes,
      discount:
        d.discount.kind === 'none' || d.discount.value <= 0
          ? { kind: 'none', value: 0 }
          : d.discount,
      payment: {
        method: d.payment.method,
        status: paid ? 'paid' : 'unpaid',
        tid: d.payment.tid,
        received: d.payment.received,
      },
      status: paid && d.orderType !== 'delivery' ? 'completed' : 'new',
      staff: req.user,
      settings,
      maxDiscountPercent:
        req.user.role === 'admin' ? null : settings.maxCashierDiscount,
    })

    res.status(201).json(order)
  }),
)

const listSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'all']).optional().default('all'),
  source: z.enum(['online', 'pos']).optional(),
  unpaid: z.enum(['1']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional().default(100),
  page: z.coerce.number().int().min(1).optional().default(1),
})

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

router.get(
  '/',
  ah(async (req, res) => {
    const q = parse(listSchema, req.query)
    const filter = {}

    if (q.status === 'active') {
      filter.status = { $in: ['new', 'preparing', 'ready'] }
    } else if (q.status !== 'all') {
      filter.status = q.status
    }

    if (q.source) filter.source = q.source

    if (q.unpaid) {
      filter['payment.status'] = { $in: ['unpaid', 'verification'] }
      if (!filter.status) filter.status = { $ne: 'cancelled' }
    }

    if (q.from || q.to) {
      filter.createdAt = {}
      if (q.from) filter.createdAt.$gte = q.from
      if (q.to) filter.createdAt.$lte = q.to
    }

    if (q.q) {
      const digits = q.q.replace(/^#/, '')

      if (/^\d+$/.test(digits) && digits.length <= 7) {
        filter.invoiceNo = Number(digits)
      } else {
        const re = new RegExp(escapeRe(q.q), 'i')
        filter.$or = [
          { 'customer.name': re },
          { 'customer.phone': re },
          { table: re },
        ]
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Order.countDocuments(filter),
    ])

    res.json({ orders, total, page: q.page })
  }),
)

// Download PDF receipt for a staff order
router.get(
  '/:id/receipt.pdf',
  ah(async (req, res) => {
    checkId(req.params.id)

    const order = await Order.findById(req.params.id)

    if (!order) {
      throw new HttpError(404, 'Order not found.')
    }

    const settings = await getSettings()
    const pdf = await createReceiptPdf(order, settings)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receipt-${order.invoiceNo}.pdf"`,
    )

    res.send(pdf)
  }),
)

router.get(
  '/:id',
  ah(async (req, res) => {
    checkId(req.params.id)

    const o = await Order.findById(req.params.id)

    if (!o) {
      throw new HttpError(404, 'Order not found.')
    }

    res.json(o)
  }),
)

const ORDER = ['new', 'preparing', 'ready', 'completed']

const statusSchema = z.object({
  status: z.enum(['preparing', 'ready', 'completed', 'cancelled']),
  reason: z.string().trim().max(200).optional().default(''),
})

router.patch(
  '/:id/status',
  ah(async (req, res) => {
    checkId(req.params.id)

    const { status, reason } = parse(statusSchema, req.body)
    const o = await Order.findById(req.params.id)

    if (!o) throw new HttpError(404, 'Order not found.')
    if (o.status === 'cancelled') {
      throw new HttpError(400, 'This order is already cancelled.')
    }

    if (status === 'cancelled') {
      const paid = o.payment.status === 'paid'

      if (
        (paid || o.status === 'completed') &&
        req.user.role !== 'admin'
      ) {
        throw new HttpError(
          403,
          'Only the admin can cancel a paid or completed bill.',
        )
      }

      o.status = 'cancelled'
      o.cancelReason = reason
      if (paid) o.payment.status = 'refunded'
    } else {
      if (ORDER.indexOf(status) <= ORDER.indexOf(o.status)) {
        throw new HttpError(400, `Order is already ${o.status}.`)
      }

      o.status = status
    }

    await o.save()
    res.json(o)
  }),
)

const paySchema = z.object({
  method: z.enum(['cash', 'card', 'wallet', 'bank']).optional(),
  received: z.coerce.number().min(0).optional(),
  tid: z.string().trim().max(60).optional(),
})

const verifyPaymentSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(200).optional().default(''),
})

// Settle a bill (cash/POS/manual counter payments)
router.patch(
  '/:id/payment',
  ah(async (req, res) => {
    checkId(req.params.id)

    const d = parse(paySchema, req.body)
    const o = await Order.findById(req.params.id)

    if (!o) throw new HttpError(404, 'Order not found.')

    if (o.status === 'cancelled') {
      throw new HttpError(400, 'This order is cancelled.')
    }

    if (o.payment.status === 'paid') {
      throw new HttpError(400, 'This bill is already paid.')
    }

    // Do not allow online transfers to bypass verification.
    if (
      o.source === 'online' &&
      ['wallet', 'bank'].includes(o.payment.method) &&
      o.payment.status === 'verification'
    ) {
      throw new HttpError(
        400,
        'Verify this online transfer before marking it as paid.',
      )
    }

    let method = d.method || o.payment.method

    if (method === 'cod') method = 'cash'

    o.payment.method = method

    if (d.tid) o.payment.tid = d.tid

    if (method === 'cash') {
      const received = d.received ?? o.total

      if (received < o.total) {
        throw new HttpError(
          400,
          'Cash received is less than the bill total.',
        )
      }

      o.payment.received = received
      o.payment.change = received - o.total
    } else {
      o.payment.received = o.total
      o.payment.change = 0
    }

    o.payment.status = 'paid'
    o.payment.paidAt = new Date()

    await o.save()
    await sendOrderEmail(o, await getSettings(), 'paid')

    res.json(o)
  }),
)

// Verify a manually submitted online wallet/bank transfer.
// Only an admin can approve or reject it.
router.patch(
  '/:id/verify-payment',
  ah(async (req, res) => {
    checkId(req.params.id)

    if (req.user.role !== 'admin') {
      throw new HttpError(
        403,
        'Only an admin can verify online payments.',
      )
    }

    const { action, note } = parse(
      verifyPaymentSchema,
      req.body,
    )

    const o = await Order.findById(req.params.id)

    if (!o) throw new HttpError(404, 'Order not found.')

    if (o.status === 'cancelled') {
      throw new HttpError(
        400,
        'A cancelled order cannot be verified.',
      )
    }

    if (o.source !== 'online') {
      throw new HttpError(
        400,
        'This action is only for online orders.',
      )
    }

    if (!['wallet', 'bank'].includes(o.payment.method)) {
      throw new HttpError(
        400,
        'This order does not use manual wallet/bank verification.',
      )
    }

    if (o.payment.status !== 'verification') {
      throw new HttpError(
        400,
        'This payment is not awaiting verification.',
      )
    }

    if (!o.payment.tid || o.payment.tid.trim().length < 6) {
      throw new HttpError(
        400,
        'A valid transaction ID is required.',
      )
    }

    if (action === 'approve') {
      // Approve only after confirming the transaction in the actual
      // receiving wallet/bank account.
      o.payment.status = 'paid'
      o.payment.paidAt = new Date()
      o.payment.received = o.total
      o.payment.change = 0
      o.payment.gatewayMessage =
        note || 'Manually verified by admin.'
    } else {
      // Rejected transfers stay unpaid; staff can contact the customer.
      o.payment.status = 'unpaid'
      o.payment.gatewayMessage =
        note || 'Payment could not be verified.'
    }

    await o.save()
    if (action === 'approve') await sendOrderEmail(o, await getSettings(), 'paid')

    res.json(o)
  }),
)

export default router
