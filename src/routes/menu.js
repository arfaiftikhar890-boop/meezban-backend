import { Router } from 'express'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { z } from 'zod'
import { MenuItem } from '../models/MenuItem.js'
import { SAMPLE_MENU } from '../data/sampleMenu.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { ah, checkId, HttpError, parse } from '../utils.js'

const router = Router()

const PHOTO_DIR = fileURLToPath(new URL('../data/menu-photos/', import.meta.url))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1.5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG or WebP images are allowed.'))),
})

// multipart fields arrive as strings
const bool = z.preprocess((v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : v), z.boolean())

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  price: z.coerce.number().min(0, 'Price must be 0 or more').max(1000000),
  category: z.string().trim().min(1, 'Category is required').max(60),
  description: z.string().trim().max(400).optional().default(''),
  available: bool.optional().default(true),
  featured: bool.optional().default(false),
  sort: z.coerce.number().optional().default(0),
  removeImage: bool.optional().default(false),
})

// Public: the whole menu (sold-out items are included so the site can show "Sold out").
router.get(
  '/',
  ah(async (req, res) => {
    const items = await MenuItem.find().select('-image').sort({ category: 1, sort: 1, name: 1 })
    res.json(items)
  }),
)

router.get(
  '/:id/image',
  ah(async (req, res) => {
    checkId(req.params.id)
    const item = await MenuItem.findById(req.params.id).select('image hasImage')
    if (!item?.hasImage || !item.image?.data) return res.status(404).end()
    res.set('Content-Type', item.image.contentType)
    res.set('Cross-Origin-Resource-Policy', 'cross-origin') // let the website (another domain) show this photo
    res.set('Cache-Control', 'public, max-age=31536000, immutable') // URL carries ?v=<version>
    res.send(item.image.data)
  }),
)

router.post(
  '/',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  ah(async (req, res) => {
    const d = parse(itemSchema, req.body)
    const doc = new MenuItem({ name: d.name, price: d.price, category: d.category, description: d.description, available: d.available, featured: d.featured, sort: d.sort })
    if (req.file) {
      doc.image = { data: req.file.buffer, contentType: req.file.mimetype }
      doc.hasImage = true
      doc.imageVersion = Date.now()
    }
    await doc.save()
    res.status(201).json(doc)
  }),
)

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  ah(async (req, res) => {
    checkId(req.params.id)
    const d = parse(itemSchema, req.body)
    const doc = await MenuItem.findById(req.params.id)
    if (!doc) throw new HttpError(404, 'Item not found.')
    Object.assign(doc, { name: d.name, price: d.price, category: d.category, description: d.description, available: d.available, featured: d.featured, sort: d.sort })
    if (req.file) {
      doc.image = { data: req.file.buffer, contentType: req.file.mimetype }
      doc.hasImage = true
      doc.imageVersion = Date.now()
    } else if (d.removeImage) {
      doc.image = undefined
      doc.hasImage = false
      doc.imageVersion = Date.now()
    }
    await doc.save()
    res.json(doc)
  }),
)

// Cashiers can mark an item sold out / available.
router.patch(
  '/:id/available',
  requireAuth,
  ah(async (req, res) => {
    checkId(req.params.id)
    const { available } = parse(z.object({ available: z.boolean() }), req.body)
    const doc = await MenuItem.findById(req.params.id).select('-image')
    if (!doc) throw new HttpError(404, 'Item not found.')
    doc.available = available
    await doc.save()
    res.json(doc)
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    checkId(req.params.id)
    const doc = await MenuItem.findByIdAndDelete(req.params.id)
    if (!doc) throw new HttpError(404, 'Item not found.')
    res.json({ ok: true })
  }),
)

router.post(
  '/seed',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    if (await MenuItem.estimatedDocumentCount()) throw new HttpError(400, 'The menu is not empty.')
    const docs = await Promise.all(
      SAMPLE_MENU.map(async ({ photo, ...item }) => {
        const doc = { ...item }
        if (photo) {
          try {
            doc.image = { data: await readFile(path.join(PHOTO_DIR, photo)), contentType: 'image/jpeg' }
            doc.hasImage = true
            doc.imageVersion = Date.now()
          } catch {
            /* photo file missing: item is seeded without an image */
          }
        }
        return doc
      }),
    )
    await MenuItem.insertMany(docs)
    res.status(201).json({ ok: true, count: docs.length })
  }),
)

export default router
