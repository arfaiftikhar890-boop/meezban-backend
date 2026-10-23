import mongoose from 'mongoose'
import { cleanJSON } from '../utils.js'

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 400 },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sort: { type: Number, default: 0 },
    hasImage: { type: Boolean, default: false },
    imageVersion: { type: Number, default: 0 },
    image: {
      data: Buffer,
      contentType: String,
    },
  },
  { timestamps: true },
)

menuItemSchema.index({ category: 1, sort: 1, name: 1 })

cleanJSON(menuItemSchema, (doc, ret) => {
  delete ret.image
  delete ret.imageVersion
  ret.imageUrl = ret.hasImage ? `/api/menu/${ret.id}/image?v=${doc.imageVersion}` : ''
})

export const MenuItem = mongoose.model('MenuItem', menuItemSchema)
