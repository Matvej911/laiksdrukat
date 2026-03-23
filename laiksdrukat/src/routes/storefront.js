import { appendFile, mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'
import { serviceRouteEntries, getSiteContent } from '../content/site.js'
import { sendContactNotification } from '../lib/mailer.js'

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-')
}

const CONTACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const CONTACT_RATE_LIMIT_MAX = 5
const contactAttempts = new Map()

function getContactRateLimitState(ip) {
  const now = Date.now()
  const attempts = (contactAttempts.get(ip) || []).filter(t => now - t < CONTACT_RATE_LIMIT_WINDOW_MS)
  contactAttempts.set(ip, attempts)
  return {
    limited: attempts.length >= CONTACT_RATE_LIMIT_MAX,
  }
}

function recordContactAttempt(ip) {
  const now = Date.now()
  const attempts = (contactAttempts.get(ip) || []).filter(t => now - t < CONTACT_RATE_LIMIT_WINDOW_MS)
  attempts.push(now)
  contactAttempts.set(ip, attempts)
}

function validateUploadBuffer(buffer, ext) {
  if (buffer.length < 4) return false

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF

    case '.png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47

    case '.webp':
      return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
             buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50

    case '.gif':
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46

    case '.svg': {
      const start = buffer.slice(0, 64).toString('utf8').trimStart()
      return start.startsWith('<svg') || start.startsWith('<?xml') || start.startsWith('<!DOCTYPE svg')
    }

    case '.pdf':
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46

    case '.doc':
      return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0

    case '.docx':
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04

    case '.eps':
    case '.ai': {
      const start = buffer.slice(0, 32).toString('utf8')
      return start.startsWith('%!PS') || start.startsWith('%PDF')
    }

    default:
      return false
  }
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

      const ext = extname(part.filename).toLowerCase()
      const buffer = await part.toBuffer()

      if (buffer.length === 0) continue

      if (!validateUploadBuffer(buffer, ext)) {
        fastify.log.warn(`Rejected contact upload: ${part.filename}`)
        continue
      }

      const safeName = sanitizeFilename(part.filename)
      const filename = `${Date.now()}-${randomUUID()}-${safeName}${safeName.endsWith(ext) ? '' : ext}`
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
      site: getSiteContent(),
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

    const rateLimit = getContactRateLimitState(request.ip)
    if (rateLimit.limited) {
      return reply.view('pages/kontakti', {
        title: 'Kontakti | Laiks Drukāt',
        description: 'Laiks Drukāt kontakti.',
        cart: fastify.getCart(request),
        error: 'Pārāk daudz ziņu. Lūdzu mēģiniet vēlreiz pēc 15 minūtēm.',
        formData: fields,
      })
    }
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
    recordContactAttempt(request.ip)
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
          orderBy: { sortOrder: 'asc' },
        })

        return reply.view('pages/services/zimogi', {
          title: `Zīmogi | Laiks Drukāt`,
          description: route.service.teaser,
          service: route.service,
          products,
          cart: fastify.getCart(request),
          site: getSiteContent(),
        })
      }

      
      if (route.service.path === '/vides-reklama') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/vides-reklama', {
          title: 'Vides reklāma | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site: getSiteContent(),
        })
      }

      if (route.service.path === '/vizitkartes') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/vizitkartes', {
          title: 'Vizītkartes | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site: getSiteContent(),
        })
      }

      if (route.service.path === '/baneri') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/baneri', {
          title: 'Banneri | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
        })
      }

      if (route.service.path === '/auto-aplimesana') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/auto-aplimesana', {
          title: 'Auto aplīmēšana | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site: getSiteContent(),
        })
      }

      if (route.service.path === '/uzlimes') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/uzlimes', {
          title: 'Uzlīmes | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
        })
      }

      if (route.service.path === '/druka') {
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.view('pages/services/druka', {
          title: 'Druka | Laiks Drukāt',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
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

    // rate limit check
    const rateLimit = getContactRateLimitState(request.ip)
    if (rateLimit.limited) {
      request.session.contactFormError = 'Pārāk daudz ziņu. Lūdzu mēģiniet vēlreiz pēc 15 minūtēm.'
      return reply.redirect(redirectPage)
    }

    if (!name || !email || !normalizedMessage) {
      request.session.contactFormError = 'Lūdzu aizpildiet vārdu, e-pastu un ziņu.'
      return reply.redirect(redirectPage)
    }

    if (normalizedMessage.length > 180) {
      request.session.contactFormError = 'Ziņa nedrīkst pārsniegt 180 rakstzīmes.'
      return reply.redirect(redirectPage)
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

    recordContactAttempt(request.ip)
    request.session.contactFormSent = true
    return reply.redirect(redirectPage)
  })

}

export default storefrontRoutes




