// Removes the "Chai & Coffee" and "Shakes & Coolers" categories from the menu database.
// Run from the server folder:  node src/scripts/remove-chai-shakes.js
// Add --confirm to actually delete. Without it, the script only shows what would be removed.
import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { MenuItem } from '../models/MenuItem.js'

const CATEGORIES = ['Chai & Coffee', 'Shakes & Coolers']
const confirm = process.argv.includes('--confirm')

await connectDb()

const items = await MenuItem.find({ category: { $in: CATEGORIES } }, 'name category').lean()
console.log(`Found ${items.length} items:`)
for (const i of items) console.log(`  ${i.category} | ${i.name}`)

if (!confirm) {
  console.log('\nNothing deleted. To delete these items run:')
  console.log('  node src/scripts/remove-chai-shakes.js --confirm')
} else {
  const res = await MenuItem.deleteMany({ category: { $in: CATEGORIES } })
  console.log(`\nDeleted ${res.deletedCount} items.`)
}

await mongoose.disconnect()