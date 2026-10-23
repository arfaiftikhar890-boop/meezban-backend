import { Router } from 'express'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { Order } from '../models/Order.js'
import { gateway } from '../services/gateway.js'
import { ah, HttpError, parse } from '../utils.js'

const router = Router()

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } })

const pkMobile = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s\-()]/g, '').replace(/^(\+92|92)/, '0'))
  .refine((s) => /^03\d{9}$/.test(s), 'Enter a valid mobile number, e.g. 0300 1234567')

const sessionSchema = z.object({
  publicId: z.string().min(6).max(40),
  provider: z.enum(['jazzcash', 'easypaisa']),
  mobile: pkMobile.optional(), // Easypaisa account number
})

function markPaid(order, message = '') {
  order.payment.status = 'paid'
  order.payment.received = order.total
  order.payment.change = 0
  order.payment.paidAt = new Date()
  order.payment.gatewayMessage = message
}

const apiBase = (req) => config.apiUrl || `https://${req.get('host')}`
const siteBase = (req) => config.clientUrl || `${req.protocol}://${req.get('host')}`

// Customer pressed "Pay": start a payment for an order they just placed.
//   JazzCash  -> { action: 'post', url, fields }  the browser submits these to JazzCash's secure page
//   Easypaisa -> { action: 'done', paid }         customer approves on their phone; we wait for the answer
router.post(
  '/session',
  limiter,
  ah(async (req, res) => {
    const { publicId, provider, mobile } = parse(sessionSchema, req.body)
    if (!gateway[provider].enabled()) throw new HttpError(400, 'This payment method is not available.')

    const order = await Order.findOne({ publicId })
    if (!order || !['online', 'jazzcash', 'easypaisa'].includes(order.payment.method)) throw new HttpError(404, 'Order not found.')
    if (order.payment.status === 'paid') throw new HttpError(400, 'This order is already paid.')
    if (order.status === 'cancelled') throw new HttpError(400, 'This order is cancelled.')

    order.payment.method = provider

    if (provider === 'jazzcash') {
      const { txnRef, url, fields } = gateway.jazzcash.buildCheckout(order, { returnUrl: `${apiBase(req)}/api/payments/jazzcash/return` })
      order.payment.txnRef = txnRef
      await order.save()
      return res.json({ action: 'post', url, fields })
    }

    if (!mobile) throw new HttpError(400, 'Enter your Easypaisa mobile number.')
    const result = await gateway.easypaisa.charge(order, { mobile })
    order.payment.txnRef = result.txnRef
    order.payment.gatewayMessage = result.message
    if (result.paid) markPaid(order, result.message)
    await order.save()
    res.json({ action: 'done', paid: result.paid, message: result.message })
  }),
)

// JazzCash sends the customer's browser back here with the result (form POST). We verify the signature,
// mark the order paid, then redirect the customer to their order page on the website.
router.post(
  '/jazzcash/return',
  express.urlencoded({ extended: false, limit: '20kb' }),
  ah(async (req, res) => {
    if (!gateway.jazzcash.enabled()) throw new HttpError(404, 'Not found.')
    const r = gateway.jazzcash.verifyReturn(req.body)
    const order = r.txnRef ? await Order.findOne({ 'payment.txnRef': r.txnRef }) : null
    if (!order) return res.redirect(303, `${siteBase(req)}/`)

    let result = 'failed'
    if (!r.valid) {
      console.warn('JazzCash return with an invalid signature for order', order.invoiceNo)
    } else if (r.paid && r.amount === Math.round(order.total * 100)) {
      if (order.payment.status !== 'paid') {
        markPaid(order, r.message)
        await order.save()
      }
      result = 'paid'
    } else {
      order.payment.gatewayMessage = r.message
      await order.save()
    }
    res.redirect(303, `${siteBase(req)}/order/${order.publicId}?payment=${result}`)
  }),
)

export default router
