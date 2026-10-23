import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { createReceiptPdf } from './receiptPdf.js'

// Order slips by email. Sending never blocks or breaks an order: every failure is logged and swallowed.
// On Vercel the function stops as soon as the response is sent, so callers must `await` these functions.

const BRAND = 'EloraTech' // shown at the bottom of every slip

let transporter
export const mailEnabled = () => Boolean(config.mail.user && config.mail.pass)

function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: { user: config.mail.user, pass: config.mail.pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    })
  }
  return transporter
}

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-PK')
const money = (n, cur) => `${cur || 'Rs.'} ${num(n)}`
const fmtDate = (d) =>
  new Date(d || Date.now()).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: config.timezone })

const METHOD = { cash: 'Cash', cod: 'Cash on delivery', card: 'Card', wallet: 'JazzCash / Easypaisa transfer', bank: 'Bank transfer', online: 'Online payment', jazzcash: 'JazzCash', easypaisa: 'Easypaisa' }
const STATUS = { unpaid: 'Unpaid', verification: 'Payment under verification', paid: 'Paid', refunded: 'Refunded' }
const TYPE = { delivery: 'Delivery', pickup: 'Pickup', dinein: 'Dine-in', takeaway: 'Takeaway' }

function note(order, kind) {
  const m = order.payment.method
  if (kind === 'paid') return 'Your payment has been received and confirmed. Thank you!'
  if (order.payment.status === 'verification')
    return `We have received your ${m === 'bank' ? 'bank transfer' : 'payment'} details${order.payment.tid ? ` (reference ${order.payment.tid})` : ''}. We will verify it shortly and email you again once it is confirmed.`
  if (order.payment.status === 'paid') return 'Your payment has been received. Thank you!'
  if (m === 'cod') return order.orderType === 'delivery' ? 'Please pay the rider in cash when your order arrives.' : 'Please pay at the restaurant when you collect your order.'
  return 'Your order has been placed.'
}


/** Where a manual payment should go. Shown only for JazzCash/Easypaisa/bank orders. */
function payAccountsText(settings) {
  const lines = ['', 'Send payment to:']
  if (settings.jazzcashNumber) lines.push(`JazzCash: ${settings.jazzcashNumber}${settings.jazzcashTitle ? ` (${settings.jazzcashTitle})` : ''}`)
  if (settings.easypaisaNumber) lines.push(`Easypaisa: ${settings.easypaisaNumber}${settings.easypaisaTitle ? ` (${settings.easypaisaTitle})` : ''}`)
  if (settings.bankEnabled && settings.bankDetails) lines.push(`Bank transfer:\n${settings.bankDetails}`)
  return lines.join('\n')
}

function payAccountsHtml(settings) {
  const rows = []
  if (settings.jazzcashNumber) rows.push(`<div><strong>JazzCash:</strong> ${esc(settings.jazzcashNumber)}${settings.jazzcashTitle ? ` (${esc(settings.jazzcashTitle)})` : ''}</div>`)
  if (settings.easypaisaNumber) rows.push(`<div><strong>Easypaisa:</strong> ${esc(settings.easypaisaNumber)}${settings.easypaisaTitle ? ` (${esc(settings.easypaisaTitle)})` : ''}</div>`)
  if (settings.bankEnabled && settings.bankDetails) rows.push(`<div><strong>Bank transfer:</strong><pre style="margin:4px 0 0;font-family:inherit;white-space:pre-line">${esc(settings.bankDetails)}</pre></div>`)
  return `<div style="margin:16px 24px;padding:12px 14px;background:#fff7e0;border:1px solid #e9c46a;border-radius:8px;font-size:14px"><strong>Send payment to:</strong>${rows.join('')}</div>`
}

export function buildSlip(order, settings, kind = 'placed') {
  const cur = settings.currency
  const pay = order.payment || {}
  const siteUrl = config.clientUrl ? `${config.clientUrl}/order/${order.publicId}` : ''
  const paid = pay.status === 'paid'
  const title = kind === 'paid' ? 'Payment confirmed' : pay.status === 'verification' ? 'Order received' : 'Order confirmed'
  const row = (a, b, strong = false) =>
    `<tr><td style="padding:5px 0;color:#5b6b85;font-size:14px">${esc(a)}</td><td style="padding:5px 0;text-align:right;font-size:14px;${strong ? 'font-weight:700;color:#13203a' : 'color:#13203a'}">${b}</td></tr>`

  const items = order.items
    .map(
      (i) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #e3eaf5;font-size:14px;color:#13203a">${esc(i.name)}</td><td style="padding:9px 8px;border-bottom:1px solid #e3eaf5;font-size:14px;text-align:center;color:#13203a">${i.qty}</td><td style="padding:9px 0;border-bottom:1px solid #e3eaf5;font-size:14px;text-align:right;color:#13203a">${num(i.price * i.qty)}</td></tr>`,
    )
    .join('')

  let html = `<!doctype html><html><body style="margin:0;padding:0;background:#eef3fa;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d6e0ee">
  <tr><td style="background:#0b1730;padding:26px 24px;text-align:center;border-bottom:3px solid #c9a24b">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:5px;color:#ffffff;font-weight:bold">${esc(settings.name.toUpperCase())}</div>
    <div style="margin-top:6px;font-size:13px;color:#e7cf8f">${esc(settings.tagline || '')}</div>
  </td></tr>
  <tr><td style="padding:26px 24px 8px">
    <div style="font-size:22px;font-weight:bold;color:#13203a">${esc(title)}</div>
    <div style="margin-top:8px;font-size:15px;line-height:22px;color:#13203a">Hi ${esc(order.customer?.name || 'there')},<br>${esc(note(order, kind))}</div>
    <div style="margin-top:14px;display:inline-block;padding:7px 14px;border-radius:999px;font-size:13px;font-weight:bold;background:${paid ? '#e3f4ec' : '#fff4d9'};color:${paid ? '#1f6b4a' : '#7a5a00'}">${esc(STATUS[pay.status] || pay.status)}</div>
  </td></tr>
  <tr><td style="padding:12px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3eaf5;margin-top:6px">
      ${row('Invoice #', `#${order.invoiceNo}`, true)}
      ${row('Date', esc(fmtDate(order.createdAt)))}
      ${row('Order type', esc(TYPE[order.orderType] || order.orderType))}
      ${order.customer?.phone ? row('Phone', esc(order.customer.phone)) : ''}
      ${order.orderType === 'delivery' && order.customer?.address ? row('Deliver to', esc(order.customer.address)) : ''}
    </table>
  </td></tr>
  <tr><td style="padding:16px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><th align="left" style="padding-bottom:6px;font-size:12px;color:#5b6b85;border-bottom:2px solid #13203a">Item</th><th style="padding-bottom:6px;font-size:12px;color:#5b6b85;border-bottom:2px solid #13203a">Qty</th><th align="right" style="padding-bottom:6px;font-size:12px;color:#5b6b85;border-bottom:2px solid #13203a">Amount</th></tr>
      ${items}
    </table>
  </td></tr>
  <tr><td style="padding:10px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Subtotal', esc(money(order.subtotal, cur)))}
      ${order.discount?.amount > 0 ? row('Discount', `− ${esc(money(order.discount.amount, cur))}`) : ''}
      ${order.tax > 0 ? row(`${settings.taxName} (${order.taxRate}%)`, esc(money(order.tax, cur))) : ''}
      ${order.deliveryFee > 0 ? row('Delivery', esc(money(order.deliveryFee, cur))) : ''}
      <tr><td style="padding:12px 0 4px;border-top:2px solid #13203a;font-size:17px;font-weight:bold;color:#13203a">Total</td><td style="padding:12px 0 4px;border-top:2px solid #13203a;text-align:right;font-size:17px;font-weight:bold;color:#13203a">${esc(money(order.total, cur))}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:14px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;border-radius:10px"><tr><td style="padding:12px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Payment method', esc(METHOD[pay.method] || pay.method))}
        ${pay.tid ? row('Transaction ID', esc(pay.tid)) : ''}
        ${paid && pay.paidAt ? row('Paid on', esc(fmtDate(pay.paidAt))) : ''}
      </table>
    </td></tr></table>
    ${order.notes ? `<div style="margin-top:12px;font-size:13px;color:#5b6b85">Your note: ${esc(order.notes)}</div>` : ''}
  </td></tr>
  ${siteUrl ? `<tr><td align="center" style="padding:22px 24px 0"><a href="${esc(siteUrl)}" style="display:inline-block;background:#c9a24b;color:#0b1730;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:999px">Track your order</a></td></tr>` : ''}
  <tr><td style="padding:26px 24px 24px;text-align:center">
    <div style="font-size:14px;color:#13203a">${esc(settings.receiptFooter || 'Thank you for ordering!')}</div>
    ${settings.phone ? `<div style="margin-top:6px;font-size:13px;color:#5b6b85">Questions? Call ${esc(settings.phone)}</div>` : ''}
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e3eaf5;font-size:12px;letter-spacing:1px;color:#8a97ad">Powered by <strong style="color:#13203a">${BRAND}</strong></div>
  </td></tr>
</table>
</td></tr></table></body></html>`

  let text = [
    `${settings.name} - ${title}`,
    '',
    `Hi ${order.customer?.name || 'there'},`,
    note(order, kind),
    '',
    `Invoice #${order.invoiceNo}   ${fmtDate(order.createdAt)}`,
    `Order type: ${TYPE[order.orderType] || order.orderType}`,
    order.orderType === 'delivery' && order.customer?.address ? `Deliver to: ${order.customer.address}` : '',
    '',
    ...order.items.map((i) => `${i.qty} x ${i.name}  ${num(i.price * i.qty)}`),
    '',
    `Subtotal: ${money(order.subtotal, cur)}`,
    order.discount?.amount > 0 ? `Discount: -${money(order.discount.amount, cur)}` : '',
    order.tax > 0 ? `${settings.taxName} (${order.taxRate}%): ${money(order.tax, cur)}` : '',
    order.deliveryFee > 0 ? `Delivery: ${money(order.deliveryFee, cur)}` : '',
    `TOTAL: ${money(order.total, cur)}`,
    '',
    `Payment: ${METHOD[pay.method] || pay.method} - ${STATUS[pay.status] || pay.status}`,
    pay.tid ? `Transaction ID: ${pay.tid}` : '',
    siteUrl ? `Track your order: ${siteUrl}` : '',
    '',
    settings.receiptFooter || '',
    `Powered by ${BRAND}`,
  ]
    .filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i !== 0))
    .join('\n')

  if (['wallet', 'bank'].includes(pay.method) && pay.status !== 'paid') {
    text += '\n' + payAccountsText(settings)
    html = html.replace('</body>', payAccountsHtml(settings) + '</body>')
  }

  const subject =
    kind === 'paid'
      ? `Payment confirmed - order #${order.invoiceNo} | ${settings.name}`
      : pay.status === 'verification'
        ? `Order #${order.invoiceNo} received, payment under verification | ${settings.name}`
        : `Your order #${order.invoiceNo} | ${settings.name}`

  return { subject, html, text }
}

/** Emails the order slip to the customer. kind: 'placed' (right after ordering) or 'paid' (payment confirmed). */
export async function sendOrderEmail(order, settings, kind = 'placed') {
  const to = order?.customer?.email
  if (!to) return { skipped: 'no-email' }
  if (!mailEnabled()) {
    console.warn('Order email skipped: SMTP_USER / SMTP_PASS are not set.')
    return { skipped: 'not-configured' }
  }
  try {
    const { subject, html, text } = buildSlip(order, settings, kind)
    const from = config.mail.from || `"${settings.name.replace(/"/g, '')}" <${config.mail.user}>`
    let attachments = []
    try {
      attachments = [{ filename: `receipt-${order.invoiceNo}.pdf`, content: await createReceiptPdf(order, settings), contentType: 'application/pdf' }]
    } catch (err) {
      console.error('Receipt PDF failed:', err.message)
    }
    await getTransport().sendMail({ from, to, subject, html, text, attachments })
    return { sent: true }
  } catch (err) {
    console.error(`Order email failed for #${order.invoiceNo}:`, err.message)
    return { error: err.message }
  }
}


/** Short alert to the restaurant owner when a new online order arrives. Never throws. */
export async function notifyAdmin(order, settings) {
  const to = config.mail.adminTo
  if (!to || !mailEnabled()) return { skipped: true }
  try {
    const pay = order.payment || {}
    const items = order.items.map((i) => `${i.qty} x ${i.name} = ${money(i.price * i.qty, settings.currency)}`).join('\n')
    const text = [
      `New online order #${order.invoiceNo}`,
      `Type: ${order.orderType}`,
      `Customer: ${order.customer?.name || '-'} (${order.customer?.phone || '-'})`,
      order.customer?.address ? `Address: ${order.customer.address}` : '',
      `Payment: ${METHOD[pay.method] || pay.method} - ${STATUS[pay.status] || pay.status}`,
      pay.tid ? `TID: ${pay.tid}` : '',
      pay.sender ? `Sender: ${pay.sender}` : '',
      '',
      items,
      '',
      `TOTAL: ${money(order.total, settings.currency)}`,
    ].join('\n')
    await getTransport().sendMail({
      from: config.mail.from || config.mail.user,
      to,
      subject: `New order #${order.invoiceNo} - ${money(order.total, settings.currency)}`,
      text,
    })
    return { sent: true }
  } catch (err) {
    console.error('Admin order email failed:', err.message)
    return { error: err.message }
  }
}
