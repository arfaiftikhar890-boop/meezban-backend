import crypto from 'node:crypto'
import mongoose from 'mongoose'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Wraps async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function parse(schema, data) {
  const r = schema.safeParse(data)
  if (r.success) return r.data
  const issue = r.error.issues[0]
  const field = issue.path.length ? issue.path.join('.') : ''
  throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message)
}

export function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id.')
  return id
}

export const newPublicId = () => crypto.randomBytes(9).toString('base64url')

// mongoose toJSON helper: expose `id`, hide internals
export function cleanJSON(schema, extra) {
  schema.set('toJSON', {
    transform(doc, ret) {
      ret.id = String(ret._id)
      delete ret._id
      delete ret.__v
      if (extra) extra(doc, ret)
      return ret
    },
  })
}

export function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
