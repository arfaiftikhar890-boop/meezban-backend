import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'store', unique: true },
    name: { type: String, default: 'Your Café' },
    tagline: { type: String, default: 'Coffee, desserts & all-day breakfast' },
    about: {
      type: String,
      default:
        'A cozy corner for specialty coffee, handcrafted desserts and comfort food. Order online for delivery or pickup — freshly made, every time.',
    },
    address: { type: String, default: 'MEZBAAN Main Albela Signal, Plot No 305, Shop No G3/G4, Garden West, Karachi, Pakistan' },
    phone: { type: String, default: '0337-2384613' },
    whatsapp: { type: String, default: '923372384613' },
    hours: { type: String, default: '24 hours' },
    currency: { type: String, default: 'Rs.' },

    // Ordering
    acceptingOrders: { type: Boolean, default: true },
    deliveryFee: { type: Number, default: 150, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },

    // Billing
    taxName: { type: String, default: 'Sales Tax' },
    taxRate: { type: Number, default: 0, min: 0, max: 50 }, // percent, added on top of the bill
    maxCashierDiscount: { type: Number, default: 10, min: 0, max: 100 }, // percent a cashier may give
    taxNumber: { type: String, default: '' }, // NTN / STRN printed on receipts
    receiptFooter: { type: String, default: 'Thank you for visiting!' },

    // Payment methods offered to online customers
    codEnabled: { type: Boolean, default: true },
    easypaisaEnabled: { type: Boolean, default: true },
    easypaisaNumber: { type: String, default: '03022679909' },
    easypaisaTitle: { type: String, default: '' },
    jazzcashNumber: { type: String, default: '03372384613' },
    jazzcashTitle: { type: String, default: '' },
    bankEnabled: { type: Boolean, default: true },
    bankDetails: { type: String, default: 'Bank: AL HABIB\nTitle: MUHAMMAD AHSAN QURESHI\nAccount: 10820981012794014\nIBAN: PK07BAHL1082098101279401' },
  },
  { timestamps: true },
)

export const Settings = mongoose.model('Settings', settingsSchema)

export async function getSettings() {
  const doc = await Settings.findOneAndUpdate({ key: 'store' }, { $setOnInsert: { key: 'store' } }, { upsert: true, returnDocument: 'after' })
  // Stores created before the real number was set still hold the placeholder: fix them once.
  const fix = {}
  if (!doc.phone || doc.phone === '0300-0000000') fix.phone = '0337-2384613'
  if (!doc.whatsapp || doc.whatsapp === '923000000000') fix.whatsapp = '923372384613'
  if (Object.keys(fix).length) {
    await Settings.updateOne({ key: 'store' }, { $set: fix })
    Object.assign(doc, fix)
  }
  const o = doc.toObject()
  delete o._id
  delete o.__v
  delete o.key
  delete o.createdAt
  delete o.updatedAt
  return o
}
