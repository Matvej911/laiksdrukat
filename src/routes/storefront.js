import { appendFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import { basename, join } from 'path'
import { serviceRouteEntries, getSiteContent } from '../content/site.js'
import { hasValidSessionCsrf } from '../lib/csrf.js'
import { sendContactNotification } from '../lib/mailer.js'
import {
  appendStructuredData,
  buildBreadcrumbSchema,
  resolvePublicBaseUrl,
  toAbsoluteUrl,
} from '../lib/seo.js'
import { getOrSetCache } from '../lib/runtime-cache.js'
import {
  contentTypeFromFilename,
  persistUpload,
  resolveUploadPath,
  sendStoredFile,
  validateDocumentOrImageUpload,
} from '../lib/uploads.js'

const CONTACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const CONTACT_RATE_LIMIT_MAX = 5
const HOME_CACHE_TTL_MS = 60 * 1000
const contactAttempts = new Map()
const currentYear = new Date().getFullYear()

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  image: true,
  category: {
    select: {
      name: true,
    },
  },
}

const categoryListSelect = {
  name: true,
  slug: true,
  _count: {
    select: { products: true },
  },
}

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

async function collectContactForm(request) {
  if (!request.isMultipart || !request.isMultipart()) {
    const fields = request.body || {}
    return {
      fields,
      uploadedFile: null,
      invalidCsrf: !hasValidSessionCsrf(request, fields._csrf),
    }
  }

  const fields = {}
  let uploadedFile = null
  const pendingFiles = []

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (!part.filename) continue

      const ext = part.filename.includes('.') ? part.filename.slice(part.filename.lastIndexOf('.')).toLowerCase() : ''
      const buffer = await part.toBuffer()

      if (buffer.length === 0) continue

      if (!validateDocumentOrImageUpload(buffer, ext)) {
        request.server.log.warn({ filename: part.filename }, 'Rejected contact upload')
        continue
      }

      pendingFiles.push({
        originalName: part.filename,
        buffer,
      })
    } else {
      fields[part.fieldname] = part.value
    }
  }

  if (!hasValidSessionCsrf(request, fields._csrf)) {
    return { fields, uploadedFile: null, invalidCsrf: true }
  }

  for (const file of pendingFiles) {
    const stored = await persistUpload({
      subdir: 'contact-attachments',
      originalName: file.originalName,
      buffer: file.buffer,
      urlPrefix: '/fails',
    })

    const upload = await request.server.db.upload.create({
      data: {
        sourceType: 'CONTACT_FORM',
        sourceRef: null,
        originalName: file.originalName,
        storedName: stored.filename,
        subdir: 'contact-attachments',
        relativePath: stored.relativePath,
        mimeType: contentTypeFromFilename(file.originalName),
        size: stored.size,
        isPrivate: true,
      },
    })

    uploadedFile = {
      originalName: file.originalName,
      path: stored.filepath,
      url: `/fails/${upload.token}`,
      token: upload.token,
    }
  }

  return { fields, uploadedFile, invalidCsrf: false }
}



async function storefrontRoutes(fastify) {
  fastify.get('/fails/:token', async (request, reply) => {
    const token = String(request.params.token || '')
    if (!token) {
      return reply.code(404).send('File not found')
    }

    const upload = await fastify.db.upload.findUnique({
      where: { token },
    })

    if (!upload || !upload.isPrivate) {
      return reply.code(404).send('File not found')
    }

    const filepath = resolveUploadPath(upload.relativePath)

    try {
      return await sendStoredFile(reply, filepath, upload.originalName, { forceDownload: true })
    } catch (error) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send('File not found')
      }
      throw error
    }
  })

  fastify.get('/media/admin-products/:filename', async (request, reply) => {
    const filename = basename(String(request.params.filename || ''))
    const filepath = join(resolveUploadPath('admin-product-images'), filename)

    try {
      return await sendStoredFile(reply, filepath, filename)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send('File not found')
      }
      throw error
    }
  })

  // Homepage
  fastify.get('/', async (request, reply) => {
    const startedAt = Date.now()
    const site = getSiteContent()
    const homepageSite = {
      ...site,
      portfolioSlider: site.portfolioSlider.slice(0, 18),
    }
    const baseUrl = resolvePublicBaseUrl()
    const canonicalUrl = `${baseUrl}/`
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
    ]
    const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
    const { hit: cacheHit, value: homeData } = await getOrSetCache(
      'storefront:home',
      HOME_CACHE_TTL_MS,
      async () => {
        const [products, categories] = await Promise.all([
          fastify.db.product.findMany({
            where: { active: true, featured: true },
            select: productCardSelect,
            orderBy: { sortOrder: 'asc' },
          }),
          fastify.db.category.findMany({
            select: categoryListSelect,
            orderBy: { name: 'asc' },
          }),
        ])

        return { products, categories }
      },
    )

    fastify.log.info({
      route: '/',
      cacheHit,
      featuredProducts: homeData.products.length,
      categories: homeData.categories.length,
      durationMs: Date.now() - startedAt,
    }, 'Route timing')

    return reply.publicView('pages/home', {
      title: 'Laiks Drukāt | Poligrāfijas un reklāmas pakalpojumi ✅',
      description:
        `Druka Jelgavā – piedāvājam zīmogus, banerus, uzlīmes, auto aplīmēšanu, kā arī vizītkartes un gaismas kastes | 1000+ projekti ⭐ Kvalitāte ✓ Ātra izpilde 🚀 ${currentYear}`,
      products: homeData.products,
      categories: homeData.categories,
      cart: fastify.getCart(request),
      site: homepageSite,
      breadcrumbs,
      seoImage: homepageSite.home.heroImage,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: homepageSite.company.name,
          legalName: homepageSite.company.legalName,
          url: canonicalUrl,
          logo: toAbsoluteUrl(baseUrl, homepageSite.meta.defaultShareImage),
          image: toAbsoluteUrl(baseUrl, homepageSite.home.heroImage),
          email: homepageSite.contact.email,
          telephone: homepageSite.contact.phones[0]?.label,
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Asteru iela 16A',
            addressLocality: 'Jelgava',
            postalCode: 'LV-3001',
            addressCountry: 'LV',
          },
          sameAs: [homepageSite.contact.facebook.url],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: homepageSite.company.name,
          url: canonicalUrl,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${baseUrl}/veikals/?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        breadcrumbSchema,
      ],
    })
  })

  // Contact page
  fastify.get('/kontakti/', async (request, reply) => {
    const startedAt = Date.now()
    const success = request.session.contactFormSent === true
    delete request.session.contactFormSent
    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Kontakti', path: '/kontakti/' },
    ]

    fastify.log.info({
      route: '/kontakti/',
      success,
      durationMs: Date.now() - startedAt,
    }, 'Route timing')

    return reply.publicView('pages/kontakti', {
      title: 'Kontakti | Laiks Drukāt – Druka un reklāma »',
      description:
        `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
      cart: fastify.getCart(request),
      success,
      breadcrumbs,
      csrf: await reply.generateCsrf(),
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })

  fastify.post('/kontakti/', async (request, reply) => {
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Kontakti', path: '/kontakti/' },
    ]
    const contactBreadcrumbs = buildBreadcrumbSchema(resolvePublicBaseUrl(), breadcrumbs)
    const { fields, uploadedFile, invalidCsrf } = await collectContactForm(request)
    if (invalidCsrf) {
      return reply.code(403).send('Invalid CSRF token')
    }

    const { name, email, phone, message } = fields
    const normalizedMessage = String(message || '').trim()

    const rateLimit = getContactRateLimitState(request.ip)
    if (rateLimit.limited) {
      return reply.publicView('pages/kontakti', {
        title: `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description: `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: 'Pārāk daudz ziņu. Lūdzu mēģiniet vēlreiz pēc 15 minūtēm.',
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        structuredData: contactBreadcrumbs,
      })
    }
    if (!name || !email || !normalizedMessage) {
      return reply.publicView('pages/kontakti', {
        title: `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description:
          `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: 'Lūdzu aizpildiet vārdu, e-pastu un ziņu.',
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        structuredData: contactBreadcrumbs,
      })
    }

    if (normalizedMessage.length > 180) {
      return reply.publicView('pages/kontakti', {
        title: `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description:
          `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: 'Ziņa nedrīkst pārsniegt 180 rakstzīmes.',
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        structuredData: contactBreadcrumbs,
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
      const result = await sendContactNotification({
        ...entry,
        db: fastify.db,
      })

      if (!result.sent) {
        fastify.log.warn({ reason: result.reason }, 'Contact notification email was not sent')
      }
    } catch (error) {
      fastify.log.error(error, 'Failed to send contact notification email')
    }
    recordContactAttempt(request.ip)
    request.session.contactFormSent = true
    return reply.redirect('/kontakti/')
  })

  for (const route of serviceRouteEntries) {
    fastify.get(route.path, async (request, reply) => {
      if (!route.canonical) {
        return reply.redirect(route.service.path, 301)
      }

      // ← special case for zimogi
      if (route.service.path === '/zimogs/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const products = await fastify.db.product.findMany({
          where: {
            active: true,
            featured: true,
            category: { slug: 'zimogi' },
          },
          select: productCardSelect,
          orderBy: { sortOrder: 'asc' },
        })

        return reply.publicView('pages/services/zimogi', {
          title: `Zīmogu izgatavošana Jelgavā⚡Ātra izgatavošana | Laiks Drukāt`,
          description: route.service.teaser,
          service: route.service,
          products,
          cart: fastify.getCart(request),
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          seoType: 'website',
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: {
              '@type': 'Organization',
              name: site.company.name,
              url: `${baseUrl}/`,
            },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
        })
      }

      
      if (route.service.path === '/vides-reklama/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/vides-reklama', {
          title: '✨Izkārtnes, gaismas kastes un reklāmas burti | Vides reklāma',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (route.service.path === '/vizitkartes/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/vizitkartes', {
          title: 'Vizītkartes – sietspiede, standarta druka | Laiks Drukāt ✅',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (route.service.path === '/baneri/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/baneri/', {
          title: 'Baneri Jelgavā – Roll-up & PVC banneri | Laiks Drukāt⭐',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (route.service.path === '/auto-aplimesana/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/auto-aplimesana', {
          title: 'Auto aplīmēšana Jelgavā – 3M & Oracal vinils | Laiks Drukāt⭐',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (route.service.path === '/uzlimes/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/uzlimes', {
          title: 'Uzlīmju druka – ruļļu, UV un lielformāta | Laiks Drukāt ✅',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (route.service.path === '/druka/') {
        const site = getSiteContent()
        const baseUrl = resolvePublicBaseUrl()
        const breadcrumbs = [
          { name: 'Sākums', path: '/' },
          { name: 'Pakalpojumi', path: '/#pakalpojumi' },
          { name: route.service.title, path: route.service.path },
        ]
        const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)
        const success = request.session.contactFormSent === true
        const error = request.session.contactFormError || null
        delete request.session.contactFormSent
        delete request.session.contactFormError

        return reply.publicView('pages/services/druka', {
          title: 'Reklāmas, poligrāfijas pakalpojumi⚡Bukleti, brošūras, plakāti',
          description: route.service.teaser,
          service: route.service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          seoImage: route.service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: route.service.title,
            description: route.service.teaser,
            serviceType: route.service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}/` },
            image: toAbsoluteUrl(baseUrl, route.service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${route.service.path}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      

      // all other services use service-page
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Pakalpojumi', path: '/#pakalpojumi' },
        { name: route.service.title, path: route.service.path },
      ]
      return reply.publicView('partials/service-page', {
        title: `${route.service.title} | Laiks Drukāt`,
        description: route.service.teaser,
        service: route.service,
        cart: fastify.getCart(request),
        site: getSiteContent(),
        breadcrumbs,
        seoImage: route.service.heroImage,
        structuredData: buildBreadcrumbSchema(resolvePublicBaseUrl(), breadcrumbs),
      })
    })
  }

  fastify.get('/privatuma-politika/', async (request, reply) => {
    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Privātuma politika', path: '/privatuma-politika/' },
    ]
    return reply.publicView('pages/privatuma-politika', {
      title: 'Privātuma politika | Laiks Drukāt',
      description: 'Privātuma politika un personas datu apstrāde.',
      cart: fastify.getCart(request),
      breadcrumbs,
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })

// Generic service contact form — handles POST from any service page
  fastify.post('/pakalpojumi-kontakts', async (request, reply) => {
    const { fields, uploadedFile, invalidCsrf } = await collectContactForm(request)
    if (invalidCsrf) {
      return reply.code(403).send('Invalid CSRF token')
    }

    const { name, email, phone, message, returnTo } = fields
    const normalizedMessage = String(message || '').trim()
    const redirectPage = returnTo || '/kontakti/'

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
      await sendContactNotification({
        ...entry,
        db: fastify.db,
      })
    } catch (error) {
      fastify.log.error(error, 'Failed to send notification')
    }

    recordContactAttempt(request.ip)
    request.session.contactFormSent = true
    return reply.redirect(redirectPage)
  })

}

export default storefrontRoutes




