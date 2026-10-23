// Updates only payment accounts, address and hours in the database. The menu is not touched.
// Run from the server folder:  node src/scripts/update-payment-settings.js
import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { Settings } from '../models/Settings.js'

await connectDb()
await Settings.updateOne(
  {},
  {
    $set: {
      name: 'MEZBAAN',
      address: 'MEZBAAN Main Albela Signal, Plot No 305, Shop No G3/G4, Garden West, Karachi, Pakistan',
      hours: '24 hours',
      jazzcashNumber: '03372384613',
      jazzcashTitle: '',
      easypaisaEnabled: true,
      easypaisaNumber: '03022679909',
      easypaisaTitle: '',
      bankEnabled: true,
      bankDetails: 'Bank: AL HABIB\nTitle: MUHAMMAD AHSAN QURESHI\nAccount: 10820981012794014\nIBAN: PK07BAHL1082098101279401',
    },
  },
  { upsert: true },
)
console.log('Payment and address settings updated. Menu unchanged.')
await mongoose.disconnect()
