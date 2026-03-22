import bcrypt from 'bcrypt'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import { unlink } from 'fs/promises'
import { basename } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, readFileSync } from 'fs'

import {
  addNotificationRecipient,
  deleteNotificationRecipient,
  getNotificationRecipients,
} from '../../lib/notification-recipients.js'
import { isMailConfigured } from '../../lib/mailer.js'


const LOGIN_RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000 // 15 minutes
const LOGIN_RATE_LIMIT_MAX = 2
const loginAttempts = new Map()

function getLoginRateLimitState(ip) {
  const now = Date.now()
  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_RATE_LIMIT_WINDOW_MS)
  loginAttempts.set(ip, attempts)
  return {
    limited: attempts.length >= LOGIN_RATE_LIMIT_MAX,
    remaining: Math.max(0, LOGIN_RATE_LIMIT_MAX - attempts.length),
  }
}

function recordLoginAttempt(ip) {
  const now = Date.now()
  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_RATE_LIMIT_WINDOW_MS)
  attempts.push(now)
  loginAttempts.set(ip, attempts)
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim()
  return normalized || null
}

async function collectProductForm(request) {
  if (!request.isMultipart || !request.isMultipart()) {
    return { fields: request.body || {}, uploads: {} }
  }

  const fields = {}
  const uploads = {}
  const uploadDir = join(process.cwd(), 'public', 'images', 'products', 'admin')
  await mkdir(uploadDir, { recursive: true })

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (!part.filename) continue

      const buffer = await part.toBuffer()
      if (buffer.length === 0) continue

      const ext = extname(part.filename) || '.bin'
      const safeName = sanitizeFilename(part.filename)
      const filename = `${Date.now()}-${randomUUID()}-${safeName}${safeName.endsWith(ext) ? '' : ext}`
      await writeFile(join(uploadDir, filename), buffer)
      uploads[part.fieldname] = `/images/products/admin/${filename}`
    } else {
      fields[part.fieldname] = part.value
    }
  }

  return { fields, uploads }
}

function buildProductPayload(fields, uploads, existingProduct = null) {
  const parsedPrice = Number.parseFloat(fields.price)
  const parsedStock = Number.parseInt(fields.stock, 10)
  const parsedCategoryId = Number.parseInt(fields.categoryId, 10)

  return {
    name: String(fields.name || '').trim(),
    slug: String(fields.slug || '').trim(),
    description: normalizeOptionalText(fields.description),
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    stock: Number.isFinite(parsedStock) ? parsedStock : 0,
    categoryId: Number.isFinite(parsedCategoryId) ? parsedCategoryId : null,
    active: fields.active === 'on' || fields.active === 'true' || fields.active === true,
    image: uploads.imageUpload || normalizeOptionalText(fields.image) || existingProduct?.image || null,
    imprintImage:
      uploads.imprintImageUpload ||
      normalizeOptionalText(fields.imprintImage) ||
      existingProduct?.imprintImage ||
      null,
  }
}

async function readContactMessages() {
  try {
    const file = await readFile(
      join(process.cwd(), 'data', 'contact-submissions', 'messages.jsonl'),
      'utf8',
    )

    return file
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function adminRoutes(fastify) {
  // Login page
  fastify.get('/login', async (request, reply) => {
    if (request.session.adminId) return reply.redirect('/admin')
    return reply.view('admin/login', { title: 'Admin | Laiks Drukāt', error: null })
  })

  // Login submit
  fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body

  // check rate limit first
  const rateLimit = getLoginRateLimitState(request.ip)
  if (rateLimit.limited) {
    return reply.view('admin/login', {
      title: 'Admin',
      error: 'Pārāk daudz mēģinājumu. Lūdzu mēģiniet vēlreiz pēc 15 minūtēm.',
    })
  }

  const user = await fastify.db.adminUser.findUnique({ where: { username } })
  if (!user) {
    recordLoginAttempt(request.ip) // record failed attempt
    return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    recordLoginAttempt(request.ip) // record failed attempt
    return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
  }

  // successful login — do NOT record attempt
  request.session.adminId = user.id
  return reply.redirect('/admin')
})

  // Logout
  fastify.post('/logout', { preHandler: fastify.csrfProtection }, async (request, reply) => {
    request.session.destroy()
    return reply.redirect('/admin/login')
  })

  // Dashboard
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const [productCount, orderCount, pendingOrders, recentOrders, contactMessages] = await Promise.all([
      fastify.db.product.count(),
      fastify.db.order.count(),
      fastify.db.order.count({ where: { status: 'PENDING' } }),
      fastify.db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      readContactMessages(),
    ])

    return reply.view('admin/dashboard', {
      title: 'Admin | Dashboard',
      productCount,
      orderCount,
      pendingOrders,
      recentOrders,
      messageCount: contactMessages.length,
      recentMessages: contactMessages.slice(0, 5),
      csrf: await reply.generateCsrf(),
    })
  })

  // --- PRODUCTS ---

  fastify.get('/products', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const products = await fastify.db.product.findMany({
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.view('admin/products', {
      title: 'Admin | Produkti',
      products,
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.get('/products/new', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', {
      title: 'Jauns produkts',
      product: null,
      categories,
      error: null,
      csrf: await reply.generateCsrf(),
    })
  })


  fastify.post('/products/new', { preHandler: fastify.requireAdmin, }, async (request, reply) => {
    const { fields, uploads } = await collectProductForm(request)
    const payload = buildProductPayload(fields, uploads)

    try {
      await fastify.db.product.create({
        data: payload,
      })
      return reply.redirect('/admin/products')
    } catch (err) {
      const categories = await fastify.db.category.findMany()
      return reply.view('admin/product-form', {
        title: 'Jauns produkts',
        product: fields,
        categories,
        error: 'Kļūda saglabājot produktu. Pārbaudiet vai slug ir unikāls.',
      })
    }
  })

  fastify.post('/products/reorder', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    const { ids } = request.body
    await Promise.all(
      ids.map((id, index) =>
        fastify.db.product.update({
          where: { id: Number(id) },
          data: { sortOrder: index }
        })
      )
    )
    return { ok: true }
  })

  fastify.get('/products/:id/edit', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const product = await fastify.db.product.findUnique({ where: { id: Number(request.params.id) } })
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', {
      title: 'Rediģēt produktu',
      product,
      categories,
      error: null,
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.post('/products/:id/edit', { preHandler: fastify.requireAdmin,  }, async (request, reply) => {
    const productId = Number(request.params.id)
    const existingProduct = await fastify.db.product.findUnique({ where: { id: productId } })
    const { fields, uploads } = await collectProductForm(request)
    const payload = buildProductPayload(fields, uploads, existingProduct)

    try {
      await fastify.db.product.update({
        where: { id: productId },
        data: payload,
      })
      return reply.redirect('/admin/products')
    } catch (err) {
      const categories = await fastify.db.category.findMany()
      return reply.view('admin/product-form', {
        title: 'Rediģēt produktu',
        product: {
          ...existingProduct,
          ...fields,
          image: uploads.imageUpload || fields.image || existingProduct?.image,
          imprintImage: uploads.imprintImageUpload || fields.imprintImage || existingProduct?.imprintImage,
          active: fields.active === 'on',
        },
        categories,
        error: 'Kļūda saglabājot produktu. Pārbaudiet vai slug ir unikāls.',
      })
    }
  })

  fastify.post('/products/:id/visibility', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    await fastify.db.product.update({
      where: { id: Number(request.params.id) },
      data: { active: request.body.active === 'true' },
    })
    return reply.redirect('/admin/products')
  })

  fastify.post('/products/:id/delete', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    await fastify.db.product.delete({ where: { id: Number(request.params.id) } })
    return reply.redirect('/admin/products')
  })

  // --- ORDERS ---

  fastify.get('/orders', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const orders = await fastify.db.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return reply.view('admin/orders', { title: 'Admin | Pasūtījumi', orders, csrf: await reply.generateCsrf(), })
  })

  fastify.get('/orders/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const order = await fastify.db.order.findUnique({
      where: { id: Number(request.params.id) },
      include: { items: { include: { product: true } } },
    })
    return reply.view('admin/order-detail', { title: `Pasūtījums #${order.id}`, order, csrf: await reply.generateCsrf(), })
  })

  fastify.post('/orders/:id/status', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    await fastify.db.order.update({
      where: { id: Number(request.params.id) },
      data: { status: request.body.status },
    })
    return reply.redirect(`/admin/orders/${request.params.id}`)
  })

  // --- CONTACT MESSAGES ---

  fastify.get('/messages', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const messages = await readContactMessages()

    return reply.view('admin/messages', {
      title: 'Admin | Ziņas',
      messages,
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.get('/messages/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const messages = await readContactMessages()
    const message = messages.find((entry) => entry.id === request.params.id)

    if (!message) {
      return reply.code(404).send('Message not found')
    }

    return reply.view('admin/message-detail', {
      title: `Ziņa no ${message.name}`,
      message,
      csrf: await reply.generateCsrf(),
    })
  })

  // --- NOTIFICATION EMAILS ---

  fastify.get('/notification-emails', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const recipients = await getNotificationRecipients()

    return reply.view('admin/notification-emails', {
      title: 'Admin | Paziņojumu e-pasti',
      recipients,
      mailConfigured: isMailConfigured(),
      error: null,
      success: request.query?.saved === '1',
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.post('/notification-emails', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    try {
      await addNotificationRecipient(request.body.email)
      return reply.redirect('/admin/notification-emails?saved=1')
    } catch (error) {
      return reply.view('admin/notification-emails', {
        title: 'Admin | Paziņojumu e-pasti',
        recipients: await getNotificationRecipients(),
        mailConfigured: isMailConfigured(),
        error: error.message || 'Neizdevās pievienot e-pasta adresi.',
        success: false,
      })
    }
  })

  fastify.post('/notification-emails/delete', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await deleteNotificationRecipient(request.body.email)
    return reply.redirect('/admin/notification-emails?saved=1')
  })

  // --- SETTINGS ---

  fastify.get('/settings', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    return reply.view('admin/settings', {
      title: 'Admin | Iestatījumi',
      success: request.query.saved === '1',
      error: null,
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.post('/settings/change-username', { preHandler: fastify.requireAdmin }, async (request, reply) => {
  const { newUsername, password } = request.body

  if (newUsername.length < 4) {
    return reply.view('admin/settings', {
      title: 'Admin | Iestatījumi',
      error: 'Lietotājvārdam jābūt vismaz 4 rakstzīmes garam.',
      success: false,
    })
  }

  const user = await fastify.db.adminUser.findUnique({
    where: { id: request.session.adminId }
  })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return reply.view('admin/settings', {
      title: 'Admin | Iestatījumi',
      error: 'Parole nav pareiza.',
      success: false,
    })
  }

  // check if username already taken
  const existing = await fastify.db.adminUser.findUnique({
    where: { username: newUsername }
  })
  if (existing && existing.id !== request.session.adminId) {
    return reply.view('admin/settings', {
      title: 'Admin | Iestatījumi',
      error: 'Šāds lietotājvārds jau eksistē.',
      success: false,
    })
  }

  await fastify.db.adminUser.update({
    where: { id: request.session.adminId },
    data: { username: newUsername }
  })

  return reply.redirect('/admin/settings?saved=1')
})

  // --- GALLERIES ---





// --- GALLERIES ---

  const GALLERIES = [
    {
      slug: 'portfolio',
      label: 'Galvenais portfolio',
      dir: fileURLToPath(new URL('../../../public/images/portfolio/', import.meta.url)),
      urlPrefix: '/images/portfolio',
    },
    {
      slug: 'car-portfolio',
      label: 'Auto aplīmēšana',
      dir: fileURLToPath(new URL('../../../public/images/car-portfolio/', import.meta.url)),
      urlPrefix: '/images/car-portfolio',
    },
    {
      slug: 'slider-vizitkartes',
      label: 'Vizītkartes galerija',
      dir: fileURLToPath(new URL('../../../public/images/slider-vizitkartes/', import.meta.url)),
      urlPrefix: '/images/slider-vizitkartes',
    },
  ]

  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg'])

  function getGallery(slug) {
    return GALLERIES.find(g => g.slug === slug)
  }

  function readGalleryImages(gallery) {
    try {
      const allFiles = readdirSync(gallery.dir)
        .filter(f => f !== '_order.json' && IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))

      let ordered = []
      try {
        const orderFile = JSON.parse(readFileSync(join(gallery.dir, '_order.json'), 'utf8'))
        // put ordered files first, then any new files not yet in order
        ordered = [
          ...orderFile.filter(f => allFiles.includes(f)),
          ...allFiles.filter(f => !orderFile.includes(f))
        ]
      } catch {
        ordered = allFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      }

      return ordered.map(filename => ({
        filename,
        url: `${gallery.urlPrefix}/${filename}`,
      }))
    } catch {
      return []
    }
  }

  fastify.get('/galleries', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const galleries = GALLERIES.map(g => ({
      ...g,
      count: readGalleryImages(g).length,
      preview: readGalleryImages(g)[0]?.url || null,
    }))
    return reply.view('admin/galleries', { title: 'Admin | Galerijas', galleries, csrf: await reply.generateCsrf(), })
  })

  fastify.get('/galleries/:slug', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const gallery = getGallery(request.params.slug)
    if (!gallery) return reply.code(404).send('Not found')
    const images = readGalleryImages(gallery)
    return reply.view('admin/gallery-detail', {
      title: `Admin | ${gallery.label}`,
      gallery,
      images,
      success: request.query.success === '1',
      error: request.query.error || null,
      csrf: await reply.generateCsrf(),
    })
  })

  fastify.post('/galleries/:slug/upload', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const gallery = getGallery(request.params.slug)
    if (!gallery) return reply.code(404).send('Not found')

    await mkdir(gallery.dir, { recursive: true })

    let csrfToken = null

    for await (const part of request.parts()) {
      if (part.type === 'field' && part.fieldname === '_csrf') {
        csrfToken = part.value
        continue
      }
      if (part.type === 'file' && part.filename) {
        const buffer = await part.toBuffer()
        if (buffer.length === 0) continue
        const ext = extname(part.filename).toLowerCase()
        if (!IMAGE_EXTENSIONS.has(ext)) continue
        const filename = `${Date.now()}-${randomUUID()}${ext}`
        await writeFile(join(gallery.dir, filename), buffer)
      }
    }

    return reply.redirect(`/admin/galleries/${gallery.slug}?success=1`)
  })

  fastify.post('/galleries/:slug/delete', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    const gallery = getGallery(request.params.slug)
    if (!gallery) return reply.code(404).send('Not found')

    const filename = basename(request.body.filename)
    const filepath = join(gallery.dir, filename)

    if (!filepath.startsWith(gallery.dir)) {
      return reply.redirect(`/admin/galleries/${gallery.slug}?error=Nederīgs+fails`)
    }

    try {
      await unlink(filepath)
    } catch {
      return reply.redirect(`/admin/galleries/${gallery.slug}?error=Neizdevās+dzēst`)
    }

    return reply.redirect(`/admin/galleries/${gallery.slug}?success=1`)
  })
  fastify.post('/galleries/:slug/reorder', { preHandler: [fastify.requireAdmin, fastify.csrfProtection] }, async (request, reply) => {
    const gallery = getGallery(request.params.slug)
    if (!gallery) return reply.code(404).send('Not found')

    const { filenames } = request.body
    await writeFile(join(gallery.dir, '_order.json'), JSON.stringify(filenames))
    return { ok: true }
  })
  

}

export default adminRoutes

