import mongoose from 'mongoose'
import { cleanJSON } from '../utils.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'cashier'], default: 'cashier' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

cleanJSON(userSchema, (doc, ret) => {
  delete ret.passwordHash
})

export const User = mongoose.model('User', userSchema)
