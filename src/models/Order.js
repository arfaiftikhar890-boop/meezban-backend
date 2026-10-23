import mongoose from 'mongoose'
import { cleanJSON } from '../utils.js'

const lineSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    invoiceNo: { type: Number, required: true, unique: true },
    publicId: { type: String, required: true, unique: true },
    source: { type: String, enum: ['online', 'pos'], required: true },
    orderType: { type: String, enum: ['delivery', 'pickup', 'dinein', 'takeaway'], required: true },
    table: { type: String, default: '' },
    customer: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    items: { type: [lineSchema], validate: (v) => v.length > 0 },

    // Money (whole rupees). All calculated on the server from current menu prices.
    subtotal: { type: Number, required: true },
    discount: {
      kind: { type: String, enum: ['none', 'percent', 'amount'], default: 'none' },
      value: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    taxRate: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },

    payment: {
      method: { type: String, enum: ['cash', 'card', 'wallet', 'bank', 'cod', 'online', 'jazzcash', 'easypaisa'], required: true },
      status: { type: String, enum: ['unpaid', 'verification', 'paid', 'refunded'], default: 'unpaid' },
      tid: { type: String, default: '' },
      sender: { type: String, default: '' },
      received: { type: Number, default: 0 },
      change: { type: Number, default: 0 },
      paidAt: Date,
      txnRef: { type: String, default: '' }, // gateway transaction reference (JazzCash / Easypaisa)
      gatewayMessage: { type: String, default: '' },
    },

    status: { type: String, enum: ['new', 'preparing', 'ready', 'completed', 'cancelled'], default: 'new' },
    cancelReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
    },
  },
  { timestamps: true },
)

orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

cleanJSON(orderSchema)

export const Order = mongoose.model('Order', orderSchema)
