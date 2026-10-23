
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { config } from '../config.js'
import { User } from '../models/User.js'

const newEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const newPassword = process.env.ADMIN_PASSWORD

try {
  if (!newEmail || !newPassword || newPassword.length < 8) {
    throw new Error('Check ADMIN_EMAIL and ADMIN_PASSWORD in .env. Password must be at least 8 characters.')
  }

  await mongoose.connect(config.mongoUri)

  const admins = await User.find({ role: 'admin' })

  if (admins.length !== 1) {
    throw new Error(
      `Expected exactly one admin, but found ${admins.length}. No account was changed.`
    )
  }

  const admin = admins[0]

  const existingUser = await User.findOne({ email: newEmail })

  if (existingUser && existingUser._id.toString() !== admin._id.toString()) {
    throw new Error('That email already belongs to another account. No account was changed.')
  }

  admin.email = newEmail
  admin.name = process.env.ADMIN_NAME || 'MEZBAAN'
  admin.passwordHash = await bcrypt.hash(newPassword, 10)
  admin.active = true

  await admin.save()

  console.log('Admin email and password updated successfully.')
  console.log(`Admin email: ${admin.email}`)
} catch (error) {
  console.error('Update failed:', error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
