import ExcelJS from 'exceljs'
import { config } from '../config.js'
import { Order } from '../models/Order.js'
import { MenuItem } from '../models/MenuItem.js'

/**
 * Item-wise sales: how many of each item were sold and for how much, split into paid and unpaid.
 * Unpaid (and "waiting for verification") orders are included; only cancelled orders are left out.
 * Item amounts are price x quantity, i.e. before discount, tax and delivery (those are on the Summary sheet).
 */

export const PERIODS = {
  today: { label: 'Today', days: 1, endOffset: 0 },
  yesterday: { label: 'Yesterday', days: 1, endOffset: -1 },
  '7d': { label: '1 week (last 7 days)', days: 7, endOffset: 0 },
  '14d': { label: '2 weeks (last 14 days)', days: 14, endOffset: 0 },
  '30d': { label: '1 month (last 30 days)', days: 30, endOffset: 0 },
}

/* ------------------------- day boundaries in the café's timezone ------------------------- */

function tzOffsetMs(date, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

// The instant at which the local day (today + addDays) starts in timezone tz.
export function startOfDay(now, tz, addDays = 0) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  )
  const guess = Date.UTC(+p.year, +p.month - 1, +p.day + addDays)
  const first = guess - tzOffsetMs(new Date(guess), tz)
  return new Date(guess - tzOffsetMs(new Date(first), tz))
}

export function periodRange(id, now = new Date(), tz = config.timezone) {
  const def = PERIODS[id]
  if (!def) return null
  const endDay = def.endOffset // 0 = today, -1 = yesterday
  const from = startOfDay(now, tz, endDay - (def.days - 1))
  const to = new Date(startOfDay(now, tz, endDay + 1).getTime() - 1)
  return { from, to }
}

/* ------------------------------------- the numbers ------------------------------------- */

const emptyTotals = () => ({
  orders: 0,
  gross: 0,
  discounts: 0,
  tax: 0,
  delivery: 0,
  net: 0,
  collected: 0,
  unpaidOrders: 0,
  unpaidTotal: 0,
  qty: 0,
})

// Pure function (no database): turns a list of orders into the report. `categoryOf(line)` is optional.
export function summarize(orders, categoryOf = () => '') {
  const items = new Map()
  const totals = emptyTotals()
  const unpaid = []

  for (const o of orders) {
    const paid = o.payment?.status === 'paid'
    totals.orders += 1
    totals.gross += o.subtotal || 0
    totals.discounts += o.discount?.amount || 0
    totals.tax += o.tax || 0
    totals.delivery += o.deliveryFee || 0
    totals.net += o.total || 0
    if (paid) totals.collected += o.total || 0
    else {
      totals.unpaidOrders += 1
      totals.unpaidTotal += o.total || 0
      unpaid.push(o)
    }

    for (const line of o.items || []) {
      const amount = (line.price || 0) * (line.qty || 0)
      let row = items.get(line.name)
      if (!row) {
        row = { name: line.name, category: categoryOf(line) || '', qty: 0, amount: 0, paidQty: 0, paidAmount: 0, unpaidQty: 0, unpaidAmount: 0 }
        items.set(line.name, row)
      }
      row.qty += line.qty
      row.amount += amount
      if (paid) {
        row.paidQty += line.qty
        row.paidAmount += amount
      } else {
        row.unpaidQty += line.qty
        row.unpaidAmount += amount
      }
      totals.qty += line.qty
    }
  }

  const list = [...items.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name))
  return { items: list, totals, unpaid }
}

export async function loadReport(id, now = new Date()) {
  const range = periodRange(id, now)
  const inRange = { createdAt: { $gte: range.from, $lte: range.to } }
  const [orders, menu, cancelled] = await Promise.all([
    Order.find({ ...inRange, status: { $ne: 'cancelled' } })
      .select('invoiceNo createdAt source orderType table customer items subtotal discount tax deliveryFee total payment status')
      .sort({ createdAt: 1 })
      .limit(50000)
      .lean(),
    MenuItem.find().select('name category').lean(),
    Order.countDocuments({ ...inRange, status: 'cancelled' }),
  ])
  const byId = new Map(menu.map((m) => [String(m._id), m.category]))
  const byName = new Map(menu.map((m) => [m.name, m.category]))
  const r = summarize(orders, (line) => byId.get(String(line.item)) || byName.get(line.name))
  r.totals.cancelled = cancelled
  return { period: id, label: PERIODS[id].label, range, ...r }
}

/* ------------------------------------- the Excel file ------------------------------------- */

const NUM = '#,##0'
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13203A' } }
const INPUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } }
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } }

function styleHeader(row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = HEAD_FILL
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  row.height = 30
}

const fmtDate = (d, tz) => new Date(d).toLocaleString('en-GB', { timeZone: tz })

export async function buildWorkbook(report, { currency = 'Rs.', timezone = config.timezone, shopName = '' } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = shopName || 'Sales report'
  wb.created = new Date()

  /* Sheet 1: one row per item, one column per figure */
  const ws = wb.addWorksheet('Item Sales', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: '#', key: 'n', width: 6 },
    { header: 'Item', key: 'name', width: 34 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Qty sold', key: 'qty', width: 11 },
    { header: `Total amount (${currency})`, key: 'amount', width: 16 },
    { header: 'Qty paid', key: 'paidQty', width: 11 },
    { header: `Amount paid (${currency})`, key: 'paidAmount', width: 16 },
    { header: 'Qty unpaid', key: 'unpaidQty', width: 11 },
    { header: `Amount unpaid (${currency})`, key: 'unpaidAmount', width: 17 },
    { header: `Cost per unit (${currency}) - type here`, key: 'cost', width: 20 },
    { header: `Profit (${currency})`, key: 'profit', width: 16 },
  ]
  styleHeader(ws.getRow(1))

  report.items.forEach((it, i) => {
    const r = i + 2
    const row = ws.addRow({ n: i + 1, name: it.name, category: it.category, qty: it.qty, amount: it.amount, paidQty: it.paidQty, paidAmount: it.paidAmount, unpaidQty: it.unpaidQty, unpaidAmount: it.unpaidAmount })
    row.getCell('cost').fill = INPUT_FILL
    row.getCell('profit').value = { formula: `IF(J${r}="","",E${r}-D${r}*J${r})`, result: '' }
  })

  const last = report.items.length + 1
  const tr = ws.addRow({ name: 'TOTAL' })
  const sum = (col, result) => ({ formula: last >= 2 ? `SUM(${col}2:${col}${last})` : '0', result })
  const t = report.items.reduce(
    (a, i) => ({ qty: a.qty + i.qty, amount: a.amount + i.amount, pq: a.pq + i.paidQty, pa: a.pa + i.paidAmount, uq: a.uq + i.unpaidQty, ua: a.ua + i.unpaidAmount }),
    { qty: 0, amount: 0, pq: 0, pa: 0, uq: 0, ua: 0 },
  )
  tr.getCell('D').value = sum('D', t.qty)
  tr.getCell('E').value = sum('E', t.amount)
  tr.getCell('F').value = sum('F', t.pq)
  tr.getCell('G').value = sum('G', t.pa)
  tr.getCell('H').value = sum('H', t.uq)
  tr.getCell('I').value = sum('I', t.ua)
  tr.getCell('K').value = sum('K', 0)
  tr.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true }
    c.fill = TOTAL_FILL
  })

  ws.eachRow((row, n) => {
    if (n === 1) return
    for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) {
      row.getCell(col).numFmt = NUM
      row.getCell(col).alignment = { horizontal: 'right' }
    }
  })
  if (report.items.length) ws.autoFilter = { from: 'A1', to: `K${last}` }

  /* Sheet 2: the totals for the period */
  const sm = wb.addWorksheet('Summary')
  sm.columns = [
    { header: 'Detail', key: 'k', width: 38 },
    { header: 'Value', key: 'v', width: 34 },
  ]
  styleHeader(sm.getRow(1))
  const tt = report.totals
  const rows = [
    ['Report', report.label],
    ['From', fmtDate(report.range.from, timezone)],
    ['To', fmtDate(report.range.to, timezone)],
    ['Orders (not cancelled)', tt.orders],
    ['Items sold (total quantity)', tt.qty],
    [`Item sales before discount (${currency})`, tt.gross],
    [`Discounts given (${currency})`, tt.discounts],
    [`Tax (${currency})`, tt.tax],
    [`Delivery charges (${currency})`, tt.delivery],
    [`Net sales incl. tax and delivery (${currency})`, tt.net],
    [`Payments received (${currency})`, tt.collected],
    ['Unpaid orders (count)', tt.unpaidOrders],
    [`Unpaid amount (${currency})`, tt.unpaidTotal],
    ['Cancelled orders (not counted above)', tt.cancelled ?? 0],
  ]
  for (const [k, v] of rows) {
    const row = sm.addRow({ k, v })
    row.getCell('k').font = { bold: true }
    row.getCell('v').alignment = { horizontal: 'left' }
    if (typeof v === 'number') row.getCell('v').numFmt = NUM
  }
  sm.addRow({})
  sm.addRow({ k: 'Note: item amounts on the "Item Sales" sheet are price x quantity, before discount, tax and delivery.' })

  /* Sheet 3: every unpaid order in the period */
  const up = wb.addWorksheet('Unpaid Orders', { views: [{ state: 'frozen', ySplit: 1 }] })
  up.columns = [
    { header: 'Invoice #', key: 'inv', width: 11 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Source', key: 'source', width: 10 },
    { header: 'Type', key: 'type', width: 11 },
    { header: 'Table', key: 'table', width: 8 },
    { header: 'Customer', key: 'cust', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Items', key: 'items', width: 50 },
    { header: `Total (${currency})`, key: 'total', width: 14 },
    { header: 'Payment method', key: 'method', width: 16 },
    { header: 'Payment status', key: 'status', width: 18 },
  ]
  styleHeader(up.getRow(1))
  for (const o of report.unpaid) {
    const row = up.addRow({
      inv: o.invoiceNo,
      date: fmtDate(o.createdAt, timezone),
      source: o.source === 'online' ? 'Website' : 'Counter',
      type: o.orderType,
      table: o.table || '',
      cust: o.customer?.name || '',
      phone: o.customer?.phone || '',
      items: (o.items || []).map((i) => `${i.qty} x ${i.name}`).join('; '),
      total: o.total,
      method: o.payment?.method || '',
      status: o.payment?.status === 'verification' ? 'Waiting for verification' : 'Unpaid',
    })
    row.getCell('total').numFmt = NUM
    row.getCell('items').alignment = { wrapText: true, vertical: 'top' }
  }
  const ur = up.addRow({ cust: 'TOTAL UNPAID', total: tt.unpaidTotal })
  ur.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true }
    c.fill = TOTAL_FILL
  })
  ur.getCell('total').numFmt = NUM
  if (!report.unpaid.length) up.addRow({ cust: 'No unpaid orders in this period.' })

  return Buffer.from(await wb.xlsx.writeBuffer())
}
