import { Router } from 'express'
import { z } from 'zod'
import { Order } from '../models/Order.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, parse, HttpError } from '../utils.js'

const router = Router()
router.use(requireAuth)

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD'),
})

// GET /api/item-sales?from=2026-11-01&to=2026-11-03
router.get(
  '/',
  ah(async (req, res) => {
    if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Only admin can view sales reports.')
    }

    const { from, to } = parse(rangeSchema, req.query)

    const start = new Date(`${from}T00:00:00+05:00`)
    const end = new Date(`${to}T23:59:59.999+05:00`)

    if (end < start) {
      throw new HttpError(400, 'Date range theek nahi hai.')
    }

    const lineAmount = { $multiply: ['$items.qty', '$items.price'] }
    const isPaid = { $eq: ['$payment.status', 'paid'] }

    const rows = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.item',
          name: { $first: '$items.name' },
          qtyAll: { $sum: '$items.qty' },
          qtyPaid: { $sum: { $cond: [isPaid, '$items.qty', 0] } },
          amountAll: { $sum: lineAmount },
          amountPaid: { $sum: { $cond: [isPaid, lineAmount, 0] } },
        },
      },
      {
        $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'menu',
        },
      },
      {
        $project: {
          name: 1,
          qtyAll: 1,
          qtyPaid: 1,
          amountAll: 1,
          amountPaid: 1,
          category: { $ifNull: [{ $arrayElemAt: ['$menu.category', 0] }, ''] },
          unitCost: { $ifNull: [{ $arrayElemAt: ['$menu.cost', 0] }, 0] },
        },
      },
      { $sort: { amountAll: -1 } },
    ])

    const items = rows.map((r) => {
      const cost = r.unitCost * r.qtyAll
      return {
        name: r.name,
        category: r.category,
        qtyPaid: r.qtyPaid,
        qtyUnpaid: r.qtyAll - r.qtyPaid,
        qty: r.qtyAll,
        amountPaid: r.amountPaid,
        amountUnpaid: r.amountAll - r.amountPaid,
        amount: r.amountAll,
        cost,
        profit: r.amountAll - cost,
      }
    })

    const sum = (key) => items.reduce((a, i) => a + i[key], 0)

    res.json({
      from,
      to,
      items,
      totalQty: sum('qty'),
      totalQtyPaid: sum('qtyPaid'),
      totalQtyUnpaid: sum('qtyUnpaid'),
      totalAmount: sum('amount'),
      totalAmountPaid: sum('amountPaid'),
      totalAmountUnpaid: sum('amountUnpaid'),
      totalCost: sum('cost'),
      totalProfit: sum('profit'),
    })
  }),
)

export default router
