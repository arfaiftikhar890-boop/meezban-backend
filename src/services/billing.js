import { MenuItem } from '../models/MenuItem.js'
import { Order } from '../models/Order.js'
import { nextInvoiceNo } from '../models/Counter.js'
import { HttpError, newPublicId } from '../utils.js'

/**
 * Bill maths. Everything is in whole rupees.
 *   discount   : percent of subtotal, or a fixed amount (never more than the subtotal)
 *   tax        : taxRate % on (subtotal - discount)
 *   total      : subtotal - discount + tax + delivery fee
 */
export function computeTotals({ subtotal, discount, taxRate = 0, deliveryFee = 0 }) {
  const d = discount || { kind: 'none', value: 0 }
  let discountAmount = 0
  if (d.kind === 'percent') discountAmount = Math.round((subtotal * Math.min(Math.max(d.value, 0), 100)) / 100)
  else if (d.kind === 'amount') discountAmount = Math.min(Math.round(Math.max(d.value, 0)), subtotal)

  const taxable = subtotal - discountAmount
  const tax = Math.round((taxable * taxRate) / 100)
  const total = taxable + tax + Math.round(deliveryFee)
  return { discountAmount, taxable, tax, total }
}

// Loads current prices from the database. The client only sends { id, qty }.
export async function buildLines(lines) {
  const merged = new Map()
  for (const l of lines) merged.set(l.id, (merged.get(l.id) || 0) + l.qty)

  const docs = await MenuItem.find({ _id: { $in: [...merged.keys()] } }).select('-image')
  const byId = new Map(docs.map((d) => [String(d._id), d]))

  const items = []
  let subtotal = 0
  for (const [id, qty] of merged) {
    const doc = byId.get(id)
    if (!doc) throw new HttpError(400, 'An item in your order no longer exists. Please refresh the menu.')
    if (!doc.available) throw new HttpError(400, `${doc.name} is sold out.`)
    if (qty > 99) throw new HttpError(400, `Too many of ${doc.name}.`)
    items.push({ item: doc._id, name: doc.name, price: doc.price, qty })
    subtotal += doc.price * qty
  }
  return { items, subtotal }
}

export async function placeOrder({ source, orderType, lines, customer, table, notes, discount, payment, status, staff, settings, maxDiscountPercent = null }) {
  const { items, subtotal } = await buildLines(lines)
  if (source === 'online' && settings.minOrder > 0 && subtotal < settings.minOrder)
    throw new HttpError(400, `Minimum order is ${settings.currency} ${settings.minOrder}.`)

  const deliveryFee = orderType === 'delivery' ? settings.deliveryFee : 0
  const t = computeTotals({ subtotal, discount, taxRate: settings.taxRate, deliveryFee })

  if (maxDiscountPercent != null && subtotal > 0 && (t.discountAmount * 100) / subtotal > maxDiscountPercent + 0.0001)
    throw new HttpError(403, `Discounts above ${maxDiscountPercent}% need the admin.`)

  const pay = { ...payment }
  if (pay.status === 'paid') {
    pay.paidAt = new Date()
    if (pay.method === 'cash') {
      const received = pay.received || t.total
      if (received < t.total) throw new HttpError(400, 'Cash received is less than the bill total.')
      pay.received = received
      pay.change = received - t.total
    } else {
      pay.received = t.total
      pay.change = 0
    }
  }

  const invoiceNo = await nextInvoiceNo()
  const order = await Order.create({
    invoiceNo,
    publicId: newPublicId(),
    source,
    orderType,
    table: table || '',
    customer: customer || {},
    items,
    subtotal,
    discount: {
      kind: discount?.kind || 'none',
      value: discount?.value || 0,
      amount: t.discountAmount,
    },
    taxRate: settings.taxRate,
    tax: t.tax,
    deliveryFee,
    total: t.total,
    payment: pay,
    status: status || 'new',
    notes: notes || '',
    createdBy: staff ? { user: staff._id, name: staff.name } : undefined,
  })
  return order
}
