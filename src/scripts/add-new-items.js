// Run from the server folder:  npm run menu:add
// Adds menu items that are not in the database yet (matched by name). Nothing is deleted or changed,
// so items you edited in Admin > Menu stay as they are. Also sets the shop phone / WhatsApp number.
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

const have = new Set((await MenuItem.find({}, 'name').lean()).map((i) => i.name))
const fresh = SAMPLE_MENU.filter((i) => !have.has(i.name))

const docs = await Promise.all(
  fresh.map(async ({ photo, ...item }) => {
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
if (docs.length) await MenuItem.insertMany(docs)
console.log(`Added ${docs.length} new menu items (${have.size} already existed).`)

await Settings.updateOne({ key: 'store' }, { $set: { phone: '0337-2384613', whatsapp: '923372384613' } }, { upsert: true })
console.log('Phone number set to 0337-2384613.')

await mongoose.disconnect()
