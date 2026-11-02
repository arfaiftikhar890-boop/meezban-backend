import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { Order } from '../models/Order.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { getSettings } from '../models/Settings.js'
import { loadReport, buildWorkbook, PERIODS } from '../services/itemSales.js'
import { ah, csvEscape, HttpError, parse } from '../utils.js'

const router = Router()
router.use(requireAuth) // every logged-in staff member; the admin-only reports below add requireAdmin themselves

const rangeSchema = z.object({ from: z.coerce.date(), to: z.coerce.date() })

function range(query) {
  const { from, to } = parse(rangeSchema, query)
  if (to < from) throw new HttpError(400, 'The end date is before the start date.')
  if (to - from > 370 * 24 * 3600 * 1000) throw new HttpError(400, 'Please choose a range of one year or less.')
  return { from, to }
}

const group = (key) => [
  { $group: { _id: key, orders: { $sum: 1 }, total: { $sum: '$total' } } },
  { $sort: { total: -1 } },
]

// ---- Item-wise sales (quantity + amount per item, unpaid orders included). Staff can see it on the POS too. ----
const periodSchema = z.object({ period: z.enum(Object.keys(PERIODS)).optional().default('today') })

router.get(
  '/items',
  ah(async (req, res) => {
    const { period } = parse(periodSchema, req.query)
    const r = await loadReport(period)
    const { unpaid, ...rest } = r // the list of unpaid orders is only needed in the Excel file
    res.json(rest)
  }),
)

router.get(
  '/items.xlsx',
  ah(async (req, res) => {
    const { period } = parse(periodSchema, req.query)
    const [r, settings] = await Promise.all([loadReport(period), getSettings()])
    const buf = await buildWorkbook(r, { currency: settings.currency, timezone: config.timezone, shopName: settings.name })
    const day = new Date().toLocaleDateString('en-CA', { timeZone: config.timezone })
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.set('Content-Disposition', `attachment; filename="item-sales-${period}-${day}.xlsx"`)
    res.send(buf)
  }),
)

router.get(
  '/summary',
  requireAdmin,
  ah(async (req, res) => {
    const { from, to } = range(req.query)
    const inRange = { createdAt: { $gte: from, $lte: to } }

    const [r] = await Order.aggregate([
      { $match: { ...inRange, status: { $ne: 'cancelled' } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                orders: { $sum: 1 },
                gross: { $sum: '$subtotal' },
                discounts: { $sum: '$discount.amount' },
                tax: { $sum: '$tax' },
                delivery: { $sum: '$deliveryFee' },
                net: { $sum: '$total' },
                collected: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$total', 0] } },
              },
            },
          ],
          byPayment: group('$payment.method'),
          byType: group('$orderType'),
          bySource: group('$source'),
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: config.timezone } },
                orders: { $sum: 1 },
                total: { $sum: '$total' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topItems: [
            { $unwind: '$items' },
            { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
            { $sort: { qty: -1, revenue: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ])

    const [cancelled, unpaid] = await Promise.all([
      Order.countDocuments({ ...inRange, status: 'cancelled' }),
      Order.aggregate([
        { $match: { ...inRange, status: { $ne: 'cancelled' }, 'payment.status': { $in: ['unpaid', 'verification'] } } },
        { $group: { _id: null, orders: { $sum: 1 }, total: { $sum: '$total' } } },
      ]),
    ])

    const t = r.totals[0] || { orders: 0, gross: 0, discounts: 0, tax: 0, delivery: 0, net: 0, collected: 0 }
    res.json({
      range: { from, to },
      totals: { ...t, avgOrder: t.orders ? Math.round(t.net / t.orders) : 0, cancelled, unpaidOrders: unpaid[0]?.orders || 0, unpaidTotal: unpaid[0]?.total || 0 },
      byPayment: r.byPayment,
      byType: r.byType,
      bySource: r.bySource,
      daily: r.daily,
      topItems: r.topItems,
    })
  }),
)

router.get(
  '/orders.csv',
  requireAdmin,
  ah(async (req, res) => {
    const { from, to } = range(req.query)
    const orders = await Order.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 }).limit(20000)
    const head = ['Invoice', 'Date', 'Source', 'Type', 'Table', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Tax', 'Delivery', 'Total', 'Payment method', 'Payment status', 'Status', 'Cashier']
    const rows = orders.map((o) => [
      o.invoiceNo,
      o.createdAt.toLocaleString('en-GB', { timeZone: config.timezone }),
      o.source,
      o.orderType,
      o.table,
      o.customer?.name,
      o.customer?.phone,
      o.items.map((i) => `${i.qty} x ${i.name}`).join('; '),
      o.subtotal,
      o.discount?.amount || 0,
      o.tax,
      o.deliveryFee,
      o.total,
      o.payment.method,
      o.payment.status,
      o.status,
      o.createdBy?.name || '',
    ])
    const csv = [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', 'attachment; filename="orders.csv"')
    res.send('﻿' + csv)
  }),
)

export default router
