import { appendFile, mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import { serviceRouteEntries } from '../content/site.js'
import { sendContactNotification } from '../lib/mailer.js'

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
    const success = request.session.contactFormSent === true
    delete request.session.contactFormSent

    return reply.view('pages/kontakti', {
      title: 'Kontakti | Laiks Drukāt',
      description:
        'Laiks Drukāt kontakti Jelgavā: adrese, tālruņi, e-pasts un Facebook saziņai.',
      cart: fastify.getCart(request),
      success,
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

    try {
      const result = await sendContactNotification(entry)

      if (!result.sent) {
        fastify.log.warn({ reason: result.reason }, 'Contact notification email was not sent')
      }
    } catch (error) {
      fastify.log.error(error, 'Failed to send contact notification email')
    }

    request.session.contactFormSent = true
    return reply.redirect('/kontakti')
  })

  for (const route of serviceRouteEntries) {
    fastify.get(route.path, async (request, reply) => {
      if (!route.canonical) {
        return reply.redirect(301, route.service.path)
      }

      // ← special case for zimogi
      if (route.service.path === '/zimogi') {
        const products = await fastify.db.product.findMany({
          where: {
            active: true,
            category: { slug: 'zimogi' },
          },
          include: { category: true },
          orderBy: { name: 'asc' },
        })

        return reply.view('pages/services/zimogi', {
          title: `Zīmogi | Laiks Drukāt`,
          description: route.service.teaser,
          service: route.service,
          products,
          cart: fastify.getCart(request),
        })
      }

      if (route.service.path === '/vides-reklama') {
            return reply.view('pages/services/vides-reklama', {
              title: `Vides reklāma | Laiks Drukāt`,
              description: route.service.teaser,
              service: route.service,
              cart: fastify.getCart(request),
            })
          }

      if (route.service.path === '/vizitkartes') {
        const success = request.session.contactFormSent === true
        delete request.session.contactFormSent

        return reply.view('pages/services/vizitkartes', {
          title: 'Vizītkartes | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
        })
      }

      // all other services use service-page
      return reply.view('partials/service-page', {
        title: `${route.service.title} | Laiks Drukāt`,
        description: route.service.teaser,
        service: route.service,
        cart: fastify.getCart(request),
      })
    })
  }

// Generic service contact form — handles POST from any service page
  fastify.post('/pakalpojumi-kontakts', async (request, reply) => {
    const { fields, uploadedFile } = await collectContactForm(request)
    const { name, email, phone, message, returnTo } = fields
    const normalizedMessage = String(message || '').trim()
    const redirectPage = returnTo || '/kontakti'

    // find the service for re-rendering if needed
    const serviceRoute = serviceRouteEntries.find(r => r.service.path === redirectPage)
    const service = serviceRoute?.service

    const viewName = service ? `pages/services${redirectPage}` : 'pages/kontakti'
    const viewData = {
      title: service ? `${service.title} | Laiks Drukāt` : 'Kontakti | Laiks Drukāt',
      service,
      cart: fastify.getCart(request),
    }

    if (!name || !email || !normalizedMessage) {
      return reply.view(viewName, { ...viewData, error: 'Lūdzu aizpildiet vārdu, e-pastu un ziņu.', formData: fields })
    }

    if (normalizedMessage.length > 180) {
      return reply.view(viewName, { ...viewData, error: 'Ziņa nedrīkst pārsniegt 180 rakstzīmes.', formData: fields })
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
      source: redirectPage,
      attachment: uploadedFile ? {
        name: uploadedFile.originalName,
        url: uploadedFile.url,
        path: uploadedFile.path,
      } : null,
    }

    await appendFile(
      join(submissionsDir, 'messages.jsonl'),
      `${JSON.stringify(entry)}\n`,
      'utf8',
    )

    try {
      await sendContactNotification(entry)
    } catch (error) {
      fastify.log.error(error, 'Failed to send notification')
    }

    return reply.view(viewName, { ...viewData, success: true })
  })

}

export default storefrontRoutes




