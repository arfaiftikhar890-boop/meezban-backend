import 'dotenv/config'

const isProd = process.env.NODE_ENV === 'production'

if (isProd && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required in production. Set it in your environment variables.')
  process.exit(1)
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cafe',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpires: '12h',
  // Only needed when the React app is hosted on a different domain than this API.
  clientOrigin: process.env.CLIENT_ORIGIN || '',
  // First admin account, created automatically when the database has no users.
  adminEmail: process.env.ADMIN_EMAIL || (isProd ? '' : 'admin@cafe.local'),
  adminPassword: process.env.ADMIN_PASSWORD || (isProd ? '' : 'admin12345'),
  adminName: process.env.ADMIN_NAME || 'Owner',
  // Used to group the sales reports by day.
  timezone: process.env.TIMEZONE || 'Asia/Karachi',
  // Public URL of the React site (used to send customers back after paying). e.g. https://my-cafe.vercel.app
  clientUrl: (process.env.CLIENT_URL || '').replace(/\/+$/, ''),
  // Public URL of this API (used for gateway return URLs). Optional: derived from the request when empty.
  apiUrl: (process.env.API_URL || '').replace(/\/+$/, ''),

  // Email (Gmail App Password). Without SMTP_USER and SMTP_PASS, emails are skipped and orders still work.
  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
    adminTo: process.env.ORDER_EMAIL_TO || '',
  },

  // Online payment gateways. A gateway is switched on automatically when all of its keys are set.
  jazzcash: {
    merchantId: process.env.JAZZCASH_MERCHANT_ID || '',
    password: process.env.JAZZCASH_PASSWORD || '',
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || '',
    sandbox: process.env.JAZZCASH_SANDBOX !== 'false', // set JAZZCASH_SANDBOX=false for live
    txnType: process.env.JAZZCASH_TXN_TYPE || '', // '' lets the customer pick card or wallet on JazzCash's page
  },
  easypaisa: {
    storeId: process.env.EASYPAISA_STORE_ID || '',
    username: process.env.EASYPAISA_USERNAME || '',
    password: process.env.EASYPAISA_PASSWORD || '',
    sandbox: process.env.EASYPAISA_SANDBOX !== 'false', // set EASYPAISA_SANDBOX=false for live
  },
}
