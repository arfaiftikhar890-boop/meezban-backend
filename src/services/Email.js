
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendNewOrderEmail(order) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !adminEmail) {
    throw new Error('SMTP email configuration is missing')
  }

  return transporter.sendMail({
    from: `"MEZBAAN" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `New Order Received - Invoice #${order.invoiceNo}`,
    text: `
A new order has been received on MEZBAAN.

Invoice: ${order.invoiceNo}
Customer: ${order.customer.name}
Phone: ${order.customer.phone}
Order Type: ${order.orderType}
Total: Rs. ${order.total}
Payment Method: ${order.payment.method}
Payment Status: ${order.payment.status}
    `,
  })
}
