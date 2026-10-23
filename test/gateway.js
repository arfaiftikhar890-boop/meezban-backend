// Offline checks for the JazzCash signing/verification (no database or network needed).
import assert from 'node:assert/strict'
process.env.JAZZCASH_MERCHANT_ID = 'MC0001'
process.env.JAZZCASH_PASSWORD = 'pw'
process.env.JAZZCASH_INTEGRITY_SALT = 'salt123'
process.env.EASYPAISA_STORE_ID = '1'
process.env.EASYPAISA_USERNAME = 'u'
process.env.EASYPAISA_PASSWORD = 'p'

const { gateway, jazzcashHash, pkTimestamp } = await import('../src/services/gateway.js')

assert.deepEqual(gateway.available(), { jazzcash: true, easypaisa: true })
assert.equal(pkTimestamp(new Date('2026-10-21T09:00:00Z')), '20261021140000')

const { txnRef, url, fields } = gateway.jazzcash.buildCheckout({ invoiceNo: 1001, total: 1190 }, { returnUrl: 'https://api.example.com/api/payments/jazzcash/return' })
assert.match(txnRef, /^T\d{14}1001$/)
assert.equal(fields.pp_Amount, '119000')
assert.ok(url.includes('sandbox.jazzcash.com.pk'))
assert.equal(fields.pp_SecureHash, jazzcashHash(fields, 'salt123'))

// Simulate JazzCash answering with a signed success response
const reply = { pp_ResponseCode: '000', pp_ResponseMessage: 'Thank you for Using JazzCash', pp_TxnRefNo: txnRef, pp_Amount: '119000', pp_BillReference: 'inv1001' }
reply.pp_SecureHash = jazzcashHash(reply, 'salt123')
let r = gateway.jazzcash.verifyReturn(reply)
assert.ok(r.valid && r.paid && r.txnRef === txnRef && r.amount === 119000)

// Tampered amount must fail the signature
r = gateway.jazzcash.verifyReturn({ ...reply, pp_Amount: '100' })
assert.ok(!r.valid && !r.paid)
// Failed payment with a valid signature is valid but not paid
const failed = { ...reply, pp_ResponseCode: '124' }
failed.pp_SecureHash = jazzcashHash(failed, 'salt123')
r = gateway.jazzcash.verifyReturn(failed)
assert.ok(r.valid && !r.paid)
// Missing signature
assert.ok(!gateway.jazzcash.verifyReturn({ ...reply, pp_SecureHash: '' }).valid)
console.log('gateway checks passed')
