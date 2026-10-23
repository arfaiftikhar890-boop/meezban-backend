// Run once from the server folder:  node src/scripts/reset-menu.js
// Deletes every menu item, loads the MEZBAAN menu (with photos), and sets the restaurant name and tagline.
import mongoose from 'mongoose'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectDb } from '../db.js'
import { MenuItem } from '../models/MenuItem.js'
import { Settings } from '../models/Settings.js'
import { SAMPLE_MENU } from '../data/sampleMenu.js'

const PHOTO_DIR = fileURLToPath(new URL('../data/menu-photos/', import.meta.url))

await connectDb()

const removed = await MenuItem.deleteMany({})
console.log(`Removed ${removed.deletedCount} old menu items.`)

const docs = await Promise.all(
  SAMPLE_MENU.map(async ({ photo, ...item }) => {
    const doc = { ...item }
    if (photo) {
      try {
        doc.image = { data: await readFile(path.join(PHOTO_DIR, photo)), contentType: 'image/jpeg' }
        doc.hasImage = true
        doc.imageVersion = Date.now()
      } catch {
        console.warn(`Photo not found: ${photo}`)
      }
    }
    return doc
  }),
)
await MenuItem.insertMany(docs)
console.log(`Added ${docs.length} MEZBAAN menu items.`)

await Settings.updateOne(
  { key: 'store' },
  { $set: { name: 'MEZBAAN', tagline: 'Dil se khilaye, mehmaan banaye', address: 'MEZBAAN Main Albela Signal, Plot No 305, Shop No G3/G4, Garden West, Karachi, Pakistan', hours: '24 hours', phone: '0337-2384613', whatsapp: '923372384613', easypaisaEnabled: true, easypaisaNumber: '03022679909', easypaisaTitle: '', jazzcashNumber: '03372384613', jazzcashTitle: '', bankEnabled: true, bankDetails: 'Bank: AL HABIB\nTitle: MUHAMMAD AHSAN QURESHI\nAccount: 10820981012794014\nIBAN: PK07BAHL1082098101279401' } },
  { upsert: true },
)
console.log('Restaurant name and tagline updated.')

await mongoose.disconnect()
