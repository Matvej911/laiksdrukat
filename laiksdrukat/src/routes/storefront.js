import { appendFile, mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import { serviceRouteEntries } from '../content/site.js'

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function collectContactForm(request) {
  if (!request.isMultipart || !request.isMultipart()) {
    return { fields: request.body || {}, uploadedFile: null }
  }

  const fields = {}
  let uploadedFile = null
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'contact-attachments')
  await mkdir(uploadDir, { recursive: true })

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (!part.filename) continue

      const ext = extname(part.filename) || '.bin'
      const safeName = sanitizeFilename(part.filename)
      const filename = `${Date.now()}-${randomUUID()}-${safeName}${safeName.endsWith(ext) ? '' : ext}`
      const buffer = await part.toBuffer()

      if (buffer.length === 0) continue

      const filepath = join(uploadDir, filename)
      await writeFile(filepath, buffer)

      uploadedFile = {
        originalName: part.filename,
        path: filepath,
        url: `/uploads/contact-attachments/${filename}`,
      }
    } else {
      fields[part.fieldname] = part.value
    }
  }

  return { fields, uploadedFile }
}

async function storefrontRoutes(fastify) {
  // Homepage
  fastify.get('/', async (request, reply) => {
    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({
        where: { active: true },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      fastify.db.category.findMany({
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return reply.view('pages/home', {
      title: 'Laiks Drukāt | Poligrāfijas un reklāmas pakalpojumi',
      description:
        'Drukas, reklāmas un zīmogu pakalpojumi Jelgavā ar ātrāku Fastify bāzētu mājaslapu.',
      products,
      categories,
      cart: fastify.getCart(request),
    })
  })

  // Contact page
  fastify.get('/kontakti', async (request, reply) => {
    return reply.view('pages/kontakti', {
      title: 'Kontakti | Laiks Drukāt',
      description:
        'Laiks Drukāt kontakti Jelgavā: adrese, tālruņi, e-pasts un Facebook saziņai.',
      cart: fastify.getCart(request),
      success: request.query?.sent === '1',
    })
  })

  fastify.post('/kontakti', async (request, reply) => {
    const { fields, uploadedFile } = await collectContactForm(request)
    const { name, email, phone, message } = fields
    const normalizedMessage = String(message || '').trim()

    if (!name || !email || !normalizedMessage) {
      return reply.view('pages/kontakti', {
        title: 'Kontakti | Laiks Drukāt',
        description:
          'Laiks Drukāt kontakti Jelgavā: adrese, tālruņi, e-pasts un Facebook saziņai.',
        cart: fastify.getCart(request),
        error: 'Lūdzu aizpildiet vārdu, e-pastu un ziņu.',
        formData: fields,
      })
    }

    if (normalizedMessage.length > 180) {
      return reply.view('pages/kontakti', {
        title: 'Kontakti | Laiks Drukāt',
        description:
          'Laiks Drukāt kontakti Jelgavā: adrese, tālruņi, e-pasts un Facebook saziņai.',
        cart: fastify.getCart(request),
        error: 'Ziņa nedrīkst pārsniegt 180 rakstzīmes.',
        formData: fields,
      })
    }

    const submissionsDir = join(process.cwd(), 'data', 'contact-submissions')
    await mkdir(submissionsDir, { recursive: true })
    const entry = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone || '').trim() || null,
      message: normalizedMessage,
      attachment: uploadedFile
        ? {
            name: uploadedFile.originalName,
            url: uploadedFile.url,
            path: uploadedFile.path,
          }
        : null,
    }

    await appendFile(
      join(submissionsDir, 'messages.jsonl'),
      `${JSON.stringify(entry)}\n`,
      'utf8',
    )

    return reply.redirect('/kontakti?sent=1')
  })

  for (const route of serviceRouteEntries) {
    fastify.get(route.path, async (request, reply) => {
      if (!route.canonical) {
        return reply.redirect(301, route.service.path)
      }

      return reply.view('partials/service-page', {
        title: `${route.service.title} | Laiks Drukāt`,
        description: route.service.teaser,
        service: route.service,
        cart: fastify.getCart(request),
      })
    })
  }
}

export default storefrontRoutes
