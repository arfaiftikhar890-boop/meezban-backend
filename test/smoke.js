// End-to-end API check. Needs a running MongoDB (default mongodb://127.0.0.1:27017).
// It uses its own database "cafe_smoke_test" and wipes it first. Run: npm test
import assert from 'node:assert/strict'

const base = process.env.MONGODB_URI_BASE || 'mongodb://127.0.0.1:27017'
process.env.MONGODB_URI = `${base}/cafe_smoke_test`
process.env.ADMIN_EMAIL = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'admin-pass-123'
process.env.JWT_SECRET = 'test-secret'
process.env.NO_LOG = '1'

const mongoose = (await import('mongoose')).default
const bcrypt = (await import('bcryptjs')).default
const { config } = await import('../src/config.js')
const { createApp } = await import('../src/app.js')
const { User } = await import('../src/models/User.js')
const { getSettings } = await import('../src/models/Settings.js')

await mongoose.connect(config.mongoUri)
await mongoose.connection.dropDatabase()
await getSettings()
await User.create({ name: 'Owner', email: process.env.ADMIN_EMAIL, role: 'admin', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10) })

const server = createApp().listen(0)
const url = `http://127.0.0.1:${server.address().port}`

async function call(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(url + path, { method, headers, body: payload })
  const type = res.headers.get('content-type') || ''
  const data = type.includes('json') ? await res.json() : await res.text()
  return { status: res.status, data }
}

let passed = 0
const ok = (name) => {
  passed++
  console.log('  ✓', name)
}

try {
  // ---------------------------------------------------------------- auth
  let r = await call('GET', '/api/health')
  assert.equal(r.status, 200)
  ok('health')

  r = await call('POST', '/api/auth/login', { body: { email: 'admin@test.local', password: 'wrong' } })
  assert.equal(r.status, 401)
  r = await call('POST', '/api/auth/login', { body: { email: 'admin@test.local', password: 'admin-pass-123' } })
  assert.equal(r.status, 200)
  const admin = r.data.token
  assert.equal(r.data.user.role, 'admin')
  assert.equal(r.data.user.passwordHash, undefined)
  ok('login (good + bad), password hash never returned')

  assert.equal((await call('GET', '/api/orders')).status, 401)
  assert.equal((await call('GET', '/api/reports/summary')).status, 401)
  ok('staff routes need a token')

  // ---------------------------------------------------------------- menu
  r = await call('POST', '/api/menu/seed', { token: admin })
  assert.equal(r.status, 201)
  r = await call('GET', '/api/menu')
  assert.equal(r.data.length, 17)
  const cappuccino = r.data.find((i) => i.name === 'Cappuccino')
  const espresso = r.data.find((i) => i.name === 'Espresso')
  assert.ok(cappuccino.id && cappuccino.image === undefined)
  ok('menu seed + public list')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const form = new FormData()
  form.set('name', 'Mocha')
  form.set('price', '600')
  form.set('category', 'Coffee')
  form.set('image', new Blob([png], { type: 'image/png' }), 'm.png')
  r = await call('POST', '/api/menu', { token: admin, form })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const mocha = r.data
  assert.ok(mocha.imageUrl.startsWith('/api/menu/'))
  const img = await fetch(url + mocha.imageUrl)
  assert.equal(img.status, 200)
  assert.equal(img.headers.get('content-type'), 'image/png')
  ok('menu item with image upload + image served')

  // ---------------------------------------------------------------- settings
  r = await call('PUT', '/api/settings', { token: admin, body: { taxRate: 5, deliveryFee: 150, minOrder: 500, maxCashierDiscount: 10 } })
  assert.equal(r.status, 200)
  assert.equal(r.data.taxRate, 5)
  assert.equal((await call('GET', '/api/settings')).data.minOrder, 500)
  ok('settings update + public read')

  // ---------------------------------------------------------------- online orders
  const cust = { name: 'Ali', phone: '0300 1234567', address: 'House 1, Street 2, Karachi' }

  r = await call('POST', '/api/orders', { body: { orderType: 'delivery', customer: cust, items: [{ id: espresso.id, qty: 1 }], paymentMethod: 'cod' } })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /Minimum order/)
  ok('minimum order enforced')

  r = await call('POST', '/api/orders', { body: { orderType: 'delivery', customer: cust, items: [{ id: cappuccino.id, qty: 2 }], paymentMethod: 'wallet' } })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /transaction ID/)
  r = await call('POST', '/api/orders', { body: { orderType: 'delivery', customer: { ...cust, phone: '12345' }, items: [{ id: cappuccino.id, qty: 2 }], paymentMethod: 'cod' } })
  assert.equal(r.status, 400)
  ok('online order validation (TID, phone)')

  // price sent by the client is ignored; server uses menu prices
  r = await call('POST', '/api/orders', { body: { orderType: 'delivery', customer: cust, items: [{ id: cappuccino.id, qty: 2, price: 1 }], paymentMethod: 'cod', total: 1 } })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  assert.equal(r.data.invoiceNo, 1001)
  const orderA = r.data
  r = await call('GET', `/api/orders/public/${orderA.publicId}`)
  assert.equal(r.status, 200)
  assert.equal(r.data.subtotal, 1040)
  assert.equal(r.data.tax, 52)
  assert.equal(r.data.deliveryFee, 150)
  assert.equal(r.data.total, 1242) // 1040 + 5% tax + 150 delivery
  assert.equal(r.data.customer.phone, undefined)
  assert.equal(r.data.payment.status, 'unpaid')
  ok('online COD order: server-side totals, tamper-proof, public tracking hides phone')

  r = await call('POST', '/api/orders', { body: { orderType: 'pickup', customer: cust, items: [{ id: cappuccino.id, qty: 2 }], paymentMethod: 'wallet', paymentRef: { tid: 'TID123456', sender: '03001234567' } } })
  assert.equal(r.status, 201)
  const orderW = r.data
  r = await call('GET', `/api/orders/public/${orderW.publicId}`)
  assert.equal(r.data.total, 1092) // pickup: no delivery fee
  assert.equal(r.data.payment.status, 'verification')
  ok('online wallet order awaits verification')

  // ---------------------------------------------------------------- staff + roles
  r = await call('POST', '/api/users', { token: admin, body: { name: 'Sara', email: 'sara@test.local', password: 'cashier-pass-1', role: 'cashier' } })
  assert.equal(r.status, 201)
  r = await call('POST', '/api/auth/login', { body: { email: 'sara@test.local', password: 'cashier-pass-1' } })
  const cashier = r.data.token
  assert.equal(r.data.user.role, 'cashier')
  assert.equal((await call('GET', '/api/users', { token: cashier })).status, 403)
  assert.equal((await call('GET', '/api/reports/summary', { token: cashier })).status, 403)
  assert.equal((await call('POST', '/api/menu/seed', { token: cashier })).status, 403)
  const me = (await call('GET', '/api/auth/me', { token: admin })).data.user
  assert.equal((await call('PATCH', `/api/users/${me.id}`, { token: admin, body: { role: 'cashier' } })).status, 400)
  ok('roles: cashier blocked from users/reports/menu admin; admin cannot demote self')

  // admin verifies the wallet payment
  r = await call('PATCH', `/api/orders/${(await call('GET', '/api/orders?q=1002', { token: cashier })).data.orders[0].id}/payment`, { token: cashier, body: {} })
  assert.equal(r.status, 200)
  assert.equal(r.data.payment.status, 'paid')
  assert.equal(r.data.payment.method, 'wallet')
  ok('wallet payment verified by staff')

  // ---------------------------------------------------------------- POS billing
  const posBase = { orderType: 'takeaway', items: [{ id: espresso.id, qty: 2 }], payNow: true }

  r = await call('POST', '/api/orders/pos', { token: cashier, body: { ...posBase, discount: { kind: 'percent', value: 25 }, payment: { method: 'cash', received: 1000 } } })
  assert.equal(r.status, 403)
  assert.match(r.data.error, /admin/)
  r = await call('POST', '/api/orders/pos', { token: cashier, body: { ...posBase, discount: { kind: 'percent', value: 10 }, payment: { method: 'cash', received: 500 } } })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /less than/)
  ok('cashier discount limit + short cash rejected')

  r = await call('POST', '/api/orders/pos', { token: cashier, body: { ...posBase, discount: { kind: 'percent', value: 10 }, payment: { method: 'cash', received: 1000 } } })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const posA = r.data
  assert.equal(posA.subtotal, 700)
  assert.equal(posA.discount.amount, 70)
  assert.equal(posA.tax, 32) // 5% of 630 = 31.5, rounded
  assert.equal(posA.total, 662)
  assert.equal(posA.payment.change, 338)
  assert.equal(posA.payment.status, 'paid')
  assert.equal(posA.status, 'completed')
  assert.equal(posA.createdBy.name, 'Sara')
  ok('POS cash bill: discount, tax, change, cashier recorded')

  r = await call('POST', '/api/orders/pos', { token: admin, body: { ...posBase, discount: { kind: 'amount', value: 100 }, payment: { method: 'card' } } })
  assert.equal(r.status, 201)
  assert.equal(r.data.total, 630) // 700 - 100 = 600, +5% = 630
  assert.equal(r.data.payment.received, 630)
  ok('POS card bill with fixed discount (admin)')

  // open dine-in tab, settle later
  r = await call('POST', '/api/orders/pos', { token: cashier, body: { orderType: 'dinein', table: 'T4', items: [{ id: cappuccino.id, qty: 1 }], payNow: false } })
  assert.equal(r.status, 201)
  const tab = r.data
  assert.equal(tab.status, 'new')
  assert.equal(tab.payment.status, 'unpaid')
  assert.equal(tab.total, 546)
  r = await call('PATCH', `/api/orders/${tab.id}/status`, { token: cashier, body: { status: 'preparing' } })
  assert.equal(r.data.status, 'preparing')
  r = await call('PATCH', `/api/orders/${tab.id}/status`, { token: cashier, body: { status: 'new' } })
  assert.equal(r.status, 400)
  r = await call('PATCH', `/api/orders/${tab.id}/payment`, { token: cashier, body: { method: 'cash', received: 500 } })
  assert.equal(r.status, 400)
  r = await call('PATCH', `/api/orders/${tab.id}/payment`, { token: cashier, body: { method: 'cash', received: 600 } })
  assert.equal(r.status, 200)
  assert.equal(r.data.payment.change, 54)
  assert.equal((await call('PATCH', `/api/orders/${tab.id}/payment`, { token: cashier, body: { method: 'cash' } })).status, 400)
  r = await call('PATCH', `/api/orders/${tab.id}/status`, { token: cashier, body: { status: 'completed' } })
  assert.equal(r.data.status, 'completed')
  ok('open dine-in bill: status flow, settle with change, no double payment')

  // sold-out items cannot be ordered
  r = await call('PATCH', `/api/menu/${mocha.id}/available`, { token: cashier, body: { available: false } })
  assert.equal(r.status, 200)
  r = await call('POST', '/api/orders/pos', { token: cashier, body: { orderType: 'takeaway', items: [{ id: mocha.id, qty: 1 }], payment: { method: 'cash' } } })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /sold out/)
  ok('sold-out item blocked; cashier can toggle availability')

  // void: cashier cannot cancel a paid bill, admin can (marks refunded)
  r = await call('POST', '/api/orders/pos', { token: cashier, body: { orderType: 'takeaway', items: [{ id: espresso.id, qty: 1 }], payment: { method: 'cash' } } })
  const voidMe = r.data
  assert.equal(voidMe.total, 368)
  assert.equal((await call('PATCH', `/api/orders/${voidMe.id}/status`, { token: cashier, body: { status: 'cancelled' } })).status, 403)
  r = await call('PATCH', `/api/orders/${voidMe.id}/status`, { token: admin, body: { status: 'cancelled', reason: 'Customer changed mind' } })
  assert.equal(r.data.status, 'cancelled')
  assert.equal(r.data.payment.status, 'refunded')
  ok('void: cashier blocked, admin cancels and bill is marked refunded')

  // ---------------------------------------------------------------- listing
  r = await call('GET', '/api/orders?status=all', { token: cashier })
  assert.equal(r.data.total, 6)
  assert.equal((await call('GET', '/api/orders?status=cancelled', { token: cashier })).data.total, 1)
  assert.equal((await call('GET', '/api/orders?unpaid=1', { token: cashier })).data.total, 1)
  assert.equal((await call('GET', '/api/orders?q=1001', { token: cashier })).data.orders[0].invoiceNo, 1001)
  assert.equal((await call('GET', '/api/orders?q=Ali', { token: cashier })).data.total, 2)
  assert.equal((await call('GET', '/api/orders?source=pos', { token: cashier })).data.total, 4)
  ok('order list filters: status, unpaid, search by invoice / name, source')

  // ---------------------------------------------------------------- reports
  const from = new Date(Date.now() - 3600e3).toISOString()
  const to = new Date(Date.now() + 3600e3).toISOString()
  r = await call('GET', `/api/reports/summary?from=${from}&to=${to}`, { token: admin })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  const t = r.data.totals
  assert.equal(t.orders, 5)
  assert.equal(t.gross, 4000)
  assert.equal(t.discounts, 170)
  assert.equal(t.tax, 192)
  assert.equal(t.delivery, 150)
  assert.equal(t.net, 4172)
  assert.equal(4000 - 170 + 192 + 150, t.net)
  assert.equal(t.collected, 2930)
  assert.equal(t.unpaidTotal, 1242)
  assert.equal(t.unpaidOrders, 1)
  assert.equal(t.cancelled, 1)
  assert.equal(t.avgOrder, 834)
  assert.equal(r.data.topItems[0].name ?? r.data.topItems[0]._id, 'Cappuccino')
  assert.equal(r.data.topItems[0].qty, 5)
  assert.equal(r.data.daily.length, 1)
  assert.equal(r.data.daily[0].total, 4172)
  const pay = Object.fromEntries(r.data.byPayment.map((x) => [x._id ?? x.key, x.total]))
  assert.deepEqual(pay, { cod: 1242, wallet: 1092, cash: 1838 })
  ok('sales report: totals reconcile, collected vs unpaid, top items, daily, by payment')

  r = await call('GET', `/api/reports/orders.csv?from=${from}&to=${to}`, { token: admin })
  assert.equal(r.status, 200)
  const lines = r.data.replace(/^﻿/, '').trim().split(/\r?\n/)
  assert.equal(lines.length, 7)
  assert.match(lines[0], /^Invoice,Date/)
  ok('CSV export')

  // ---------------------------------------------------------------- password change
  r = await call('POST', '/api/auth/change-password', { token: cashier, body: { current: 'cashier-pass-1', next: 'new-pass-12345' } })
  assert.equal(r.status, 200)
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'sara@test.local', password: 'new-pass-12345' } })).status, 200)
  ok('password change')

  console.log(`\nAll ${passed} checks passed.`)
} catch (e) {
  console.error('\nFAILED:', e.message)
  if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'))
  process.exitCode = 1
} finally {
  server.close()
  await mongoose.connection.dropDatabase().catch(() => {})
  await mongoose.disconnect()
}
