import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
})

export const Counter = mongoose.model('Counter', counterSchema)

// Atomic, gap-free invoice numbers. First invoice is #1001.
export async function nextInvoiceNo() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'invoice' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return 1000 + c.seq
}
