import bcrypt from 'bcrypt'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import {
  addNotificationRecipient,
  deleteNotificationRecipient,
  getNotificationRecipients,
} from '../../lib/notification-recipients.js'
import { isMailConfigured } from '../../lib/mailer.js'

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

    const user = await fastify.db.adminUser.findUnique({ where: { username } })
    if (!user) {
      return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
    }

    request.session.adminId = user.id
    return reply.redirect('/admin')
  })

  // Logout
  fastify.post('/logout', async (request, reply) => {
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
    })
  })

  // --- PRODUCTS ---

  fastify.get('/products', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const products = await fastify.db.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.view('admin/products', { title: 'Admin | Produkti', products })
  })

  fastify.get('/products/new', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', { title: 'Jauns produkts', product: null, categories, error: null })
  })

  fastify.post('/products/new', { preHandler: fastify.requireAdmin }, async (request, reply) => {
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

  fastify.get('/products/:id/edit', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const product = await fastify.db.product.findUnique({ where: { id: Number(request.params.id) } })
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', { title: 'Rediģēt produktu', product, categories, error: null })
  })

  fastify.post('/products/:id/edit', { preHandler: fastify.requireAdmin }, async (request, reply) => {
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

  fastify.post('/products/:id/visibility', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await fastify.db.product.update({
      where: { id: Number(request.params.id) },
      data: { active: request.body.active === 'true' },
    })
    return reply.redirect('/admin/products')
  })

  fastify.post('/products/:id/delete', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await fastify.db.product.delete({ where: { id: Number(request.params.id) } })
    return reply.redirect('/admin/products')
  })

  // --- ORDERS ---

  fastify.get('/orders', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const orders = await fastify.db.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return reply.view('admin/orders', { title: 'Admin | Pasūtījumi', orders })
  })

  fastify.get('/orders/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const order = await fastify.db.order.findUnique({
      where: { id: Number(request.params.id) },
      include: { items: { include: { product: true } } },
    })
    return reply.view('admin/order-detail', { title: `Pasūtījums #${order.id}`, order })
  })

  fastify.post('/orders/:id/status', { preHandler: fastify.requireAdmin }, async (request, reply) => {
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
    })
  })

  fastify.post('/notification-emails', { preHandler: fastify.requireAdmin }, async (request, reply) => {
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
}

export default adminRoutes
