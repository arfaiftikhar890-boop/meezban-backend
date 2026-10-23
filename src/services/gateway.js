import crypto from 'node:crypto'
import { config } from '../config.js'
import { HttpError } from '../utils.js'

/**
 * Online payment gateways: JazzCash (hosted checkout, card or wallet) and Easypaisa (wallet push).
 * A gateway is "available" when all of its keys are present in the environment (see server/.env.example).
 * Keys live only on the server; the React app never sees them.
 *
 * IMPORTANT: both integrations follow the merchant documentation as of writing, but every merchant account
 * is provisioned slightly differently. Test in the gateway's SANDBOX first and compare with the
 * documentation/Postman collection your account manager sends you.
 */

/* ------------------------------- helpers ------------------------------- */

// Pakistan time (UTC+5, no daylight saving) as YYYYMMDDHHmmss, which is what JazzCash expects.
export function pkTimestamp(date = new Date()) {
  const d = new Date(date.getTime() + 5 * 3600 * 1000)
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

/* ------------------------------- JazzCash ------------------------------ */

const JC_URL = {
  sandbox: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
  live: 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
}

/**
 * JazzCash secure hash: HMAC-SHA256 (key = integrity salt) over
 *   salt & value1 & value2 & ...   where the values are every non-empty pp_* field sorted by field name.
 */
export function jazzcashHash(fields, salt) {
  const parts = Object.keys(fields)
    .filter((k) => k.startsWith('pp') && k !== 'pp_SecureHash' && fields[k] !== '' && fields[k] != null)
    .sort()
    .map((k) => String(fields[k]))
  return crypto.createHmac('sha256', salt).update([salt, ...parts].join('&')).digest('hex').toUpperCase()
}

const jazzcash = {
  enabled: () => Boolean(config.jazzcash.merchantId && config.jazzcash.password && config.jazzcash.integritySalt),

  /** Returns what the browser must POST to JazzCash: { url, fields }. */
  buildCheckout(order, { returnUrl }) {
    const c = config.jazzcash
    const now = new Date()
    const txnRef = `T${pkTimestamp(now)}${String(order.invoiceNo).slice(-5)}`
    const fields = {
      pp_Version: '1.1',
      pp_TxnType: c.txnType,
      pp_Language: 'EN',
      pp_MerchantID: c.merchantId,
      pp_SubMerchantID: '',
      pp_Password: c.password,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: txnRef,
      pp_Amount: String(Math.round(order.total * 100)), // paisas
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: pkTimestamp(now),
      pp_BillReference: `inv${order.invoiceNo}`,
      pp_Description: `Order ${order.invoiceNo}`,
      pp_TxnExpiryDateTime: pkTimestamp(new Date(now.getTime() + 60 * 60 * 1000)),
      pp_ReturnURL: returnUrl,
      ppmpf_1: '1',
      ppmpf_2: '2',
      ppmpf_3: '3',
      ppmpf_4: '4',
      ppmpf_5: '5',
    }
    fields.pp_SecureHash = jazzcashHash(fields, c.integritySalt)
    return { txnRef, url: c.sandbox ? JC_URL.sandbox : JC_URL.live, fields }
  },

  /** Checks the signature of the data JazzCash posts back and tells whether the payment succeeded. */
  verifyReturn(body) {
    const given = String(body?.pp_SecureHash || '').toUpperCase()
    const expected = jazzcashHash(body || {}, config.jazzcash.integritySalt)
    const valid = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    return {
      valid,
      paid: valid && body.pp_ResponseCode === '000',
      txnRef: String(body?.pp_TxnRefNo || ''),
      amount: Number(body?.pp_Amount) || 0, // paisas
      message: String(body?.pp_ResponseMessage || ''),
    }
  },
}

/* ------------------------------- Easypaisa ----------------------------- */

const EP_URL = {
  sandbox: 'https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction',
  live: 'https://easypay.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction',
}

const easypaisa = {
  enabled: () => Boolean(config.easypaisa.storeId && config.easypaisa.username && config.easypaisa.password),

  /**
   * Mobile-account payment: Easypaisa sends an approval request to the customer's Easypaisa account
   * (app / USSD) and answers after the customer approves or rejects.
   * Returns { paid, txnRef, message }.
   */
  async charge(order, { mobile }) {
    const c = config.easypaisa
    const txnRef = `${order.invoiceNo}-${crypto.randomInt(1000, 9999)}`
    let res
    try {
      res = await fetch(c.sandbox ? EP_URL.sandbox : EP_URL.live, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Credentials: Buffer.from(`${c.username}:${c.password}`).toString('base64'),
        },
        body: JSON.stringify({
          orderId: txnRef,
          storeId: c.storeId,
          transactionAmount: Number(order.total).toFixed(1),
          transactionType: 'MA',
          mobileAccountNo: mobile,
          emailAddress: 'customer@example.com',
        }),
        signal: AbortSignal.timeout(55000),
      })
    } catch {
      throw new HttpError(502, 'Easypaisa did not respond. Please try again or choose another payment method.')
    }
    const data = await res.json().catch(() => ({}))
    const paid = data.responseCode === '0000'
    return { paid, txnRef, message: String(data.responseDesc || data.responseMessage || (paid ? 'Paid' : 'Payment was not completed')) }
  },
}

/* -------------------------------- public ------------------------------- */

export const gateway = {
  jazzcash,
  easypaisa,
  available: () => ({ jazzcash: jazzcash.enabled(), easypaisa: easypaisa.enabled() }),
  enabled: () => jazzcash.enabled() || easypaisa.enabled(),
}
