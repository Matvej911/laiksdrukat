import { randomUUID } from 'crypto'
import { basename, join } from 'path'
import { getSiteContent, serviceRouteEntries } from '../content/site.js'
import { hasValidSessionCsrf } from '../lib/csrf.js'
import { saveContactMessage } from '../lib/contact-messages.js'
import { sendContactNotification } from '../lib/mailer.js'
import {
  buildServiceRouteEntries,
  getUiCopy,
  localizePath,
  localizeSiteContent,
} from '../lib/marketing-locale.js'
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
const DEFAULT_ORDER_UPLOAD_PUBLIC_TTL_MS = 30 * 24 * 60 * 60 * 1000
const contactAttempts = new Map()
const currentYear = new Date().getFullYear()

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const ORDER_UPLOAD_PUBLIC_TTL_MS = parsePositiveInt(
  process.env.ORDER_UPLOAD_PUBLIC_TTL_MS,
  DEFAULT_ORDER_UPLOAD_PUBLIC_TTL_MS,
)
const ALLOWED_CONTACT_RETURN_PATHS = new Set([
  '/kontakti/',
  ...serviceRouteEntries.map((entry) => entry.path),
  ...serviceRouteEntries.map((entry) => entry.service.path),
])

function getActiveAttempts(map, key, windowMs) {
  const now = Date.now()
  const attempts = (map.get(key) || []).filter((timestamp) => now - timestamp < windowMs)

  if (attempts.length === 0) {
    map.delete(key)
  } else {
    map.set(key, attempts)
  }

  return attempts
}

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  image: true,
  category: {
    select: {
      name: true,
      slug: true,
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
  const attempts = getActiveAttempts(contactAttempts, ip, CONTACT_RATE_LIMIT_WINDOW_MS)
  return {
    limited: attempts.length >= CONTACT_RATE_LIMIT_MAX,
  }
}

function recordContactAttempt(ip) {
  const now = Date.now()
  const attempts = getActiveAttempts(contactAttempts, ip, CONTACT_RATE_LIMIT_WINDOW_MS)
  attempts.push(now)
  contactAttempts.set(ip, attempts)
}

function normalizeContactReturnTo(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return '/kontakti/'
  }

  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return '/kontakti/'
  }

  let pathname = raw

  try {
    pathname = new URL(raw, 'https://www.laiksdrukat.lv').pathname
  } catch {
    return '/kontakti/'
  }

  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`
  }

  return ALLOWED_CONTACT_RETURN_PATHS.has(pathname)
    ? pathname
    : '/kontakti/'
}

function isAdminSession(request) {
  return Boolean(request.session?.adminId)
}

function isPublicUploadAccessAllowed(upload, request) {
  if (!upload?.isPrivate) {
    return true
  }

  if (isAdminSession(request)) {
    return true
  }

  if (upload.sourceType === 'CONTACT_FORM') {
    return false
  }

  if (upload.sourceType === 'STAMP_ORDER') {
    const createdAt = upload.createdAt instanceof Date
      ? upload.createdAt
      : new Date(upload.createdAt)

    if (Number.isNaN(createdAt.getTime())) {
      return false
    }

    return (Date.now() - createdAt.getTime()) <= ORDER_UPLOAD_PUBLIC_TTL_MS
  }

  return false
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

function notifyContactSubmission(fastify, entry) {
  setImmediate(async () => {
    try {
      const result = await sendContactNotification({
        ...entry,
        db: fastify.db,
      })

      if (!result.sent) {
        fastify.log.warn({ reason: result.reason, entryId: entry.id }, 'Contact notification email was not sent')
      }
    } catch (error) {
      fastify.log.error({ err: error, entryId: entry.id }, 'Failed to send contact notification email')
    }
  })
}



async function storefrontRoutes(fastify, opts = {}) {
  const locale = opts.locale === 'ru' ? 'ru' : 'lv'
  const ui = getUiCopy(locale)
  const localizedPath = (path) => localizePath(locale, path)
  const getLocalizedSite = () => localizeSiteContent(getSiteContent(), locale)
  const getServiceRoutes = () => buildServiceRouteEntries(getLocalizedSite())

  if (locale === 'lv') {
    fastify.get('/fails/:token', async (request, reply) => {
      const token = String(request.params.token || '')
      if (!token) {
        return reply.code(404).send('File not found')
      }

    const upload = await fastify.db.upload.findUnique({
      where: { token },
    })

    if (!upload || !upload.isPrivate || !isPublicUploadAccessAllowed(upload, request)) {
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
  }

  // Homepage
  fastify.get('/', async (request, reply) => {
    const startedAt = Date.now()
    const site = getLocalizedSite()
    const homepageSite = {
      ...site,
      portfolioSlider: site.portfolioSlider.slice(0, 63),
    }
    const baseUrl = resolvePublicBaseUrl()
    const canonicalUrl = `${baseUrl}${localizedPath('/')}`
    const breadcrumbs = [
      { name: ui.breadcrumbs.home, path: localizedPath('/') },
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

    const localizedProducts = locale === 'ru'
      ? homeData.products.map((product) => ({
          ...product,
          category: {
            ...product.category,
            name: site.shop.categories.find((category) => category.slug === product.category.slug)?.title || product.category.name,
          },
        }))
      : homeData.products

    return reply.publicView('pages/home', {
      title: locale === 'ru'
        ? 'Laiks Drukāt | Печать, реклама и визуальные решения'
        : 'Laiks Drukāt | Poligrāfijas un reklāmas pakalpojumi ✅',
      description: homepageSite.meta.description,
      products: localizedProducts,
      categories: homeData.categories,
      cart: fastify.getCart(request),
      site: homepageSite,
      breadcrumbs,
      locale,
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
      { name: ui.breadcrumbs.home, path: localizedPath('/') },
      { name: ui.breadcrumbs.contacts, path: localizedPath('/kontakti/') },
    ]

    fastify.log.info({
      route: '/kontakti/',
      success,
      durationMs: Date.now() - startedAt,
    }, 'Route timing')

    return reply.publicView('pages/kontakti', {
      title: locale === 'ru'
        ? 'Контакты | Laiks Drukāt'
        : 'Kontakti | Laiks Drukāt – Druka un reklāma »',
      description: locale === 'ru'
        ? `Контакты, рабочее время и связь с Laiks Drukāt: печать, рекламные решения, штампы, баннеры и оклейка автомобилей в Елгаве. ${currentYear}`
        : `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
      cart: fastify.getCart(request),
      success,
      breadcrumbs,
      csrf: await reply.generateCsrf(),
      site: getLocalizedSite(),
      locale,
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })

  fastify.post('/kontakti/', async (request, reply) => {
    const breadcrumbs = [
      { name: ui.breadcrumbs.home, path: localizedPath('/') },
      { name: ui.breadcrumbs.contacts, path: localizedPath('/kontakti/') },
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
        title: locale === 'ru' ? 'Контакты | Laiks Drukāt' : `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description: locale === 'ru'
          ? `Контакты, рабочее время и связь с Laiks Drukāt: печать, рекламные решения, штампы, баннеры и оклейка автомобилей в Елгаве. ${currentYear}`
          : `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: ui.contact.errors.rateLimit,
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        site: getLocalizedSite(),
        locale,
        structuredData: contactBreadcrumbs,
      })
    }
    if (!name || !email || !normalizedMessage) {
      return reply.publicView('pages/kontakti', {
        title: locale === 'ru' ? 'Контакты | Laiks Drukāt' : `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description: locale === 'ru'
          ? `Контакты, рабочее время и связь с Laiks Drukāt: печать, рекламные решения, штампы, баннеры и оклейка автомобилей в Елгаве. ${currentYear}`
          : `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: ui.contact.errors.required,
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        site: getLocalizedSite(),
        locale,
        structuredData: contactBreadcrumbs,
      })
    }

    if (normalizedMessage.length > 180) {
      return reply.publicView('pages/kontakti', {
        title: locale === 'ru' ? 'Контакты | Laiks Drukāt' : `Kontakti | Laiks Drukāt – Druka un reklāma »`,
        description: locale === 'ru'
          ? `Контакты, рабочее время и связь с Laiks Drukāt: печать, рекламные решения, штампы, баннеры и оклейка автомобилей в Елгаве. ${currentYear}`
          : `Kontakti un darba laiks ⚡ Druka un reklāmas pakalpojumi – baneri, zīmogi, auto aplīmēšana | ☎ 29 109 703, Asteru iela 16A, Jelgava | Sazinieties ar mums! ${currentYear}`,
        cart: fastify.getCart(request),
        error: ui.contact.errors.length,
        formData: fields,
        breadcrumbs,
        csrf: await reply.generateCsrf(),
        site: getLocalizedSite(),
        locale,
        structuredData: contactBreadcrumbs,
      })
    }

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

    await saveContactMessage(entry, fastify.db)

    notifyContactSubmission(fastify, entry)
    recordContactAttempt(request.ip)
    request.session.contactFormSent = true
    return reply.redirect(localizedPath('/kontakti/'))
  })

  for (const route of getServiceRoutes()) {
    fastify.get(route.path, async (request, reply) => {
      const site = getLocalizedSite()
      const service = route.service
      const baseUrl = resolvePublicBaseUrl()
      const breadcrumbs = [
        { name: ui.breadcrumbs.home, path: localizedPath('/') },
        { name: ui.breadcrumbs.services, path: localizedPath('/#pakalpojumi') },
        { name: service.title, path: localizedPath(service.path) },
      ]
      const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, breadcrumbs)

      if (!route.canonical) {
        return reply.redirect(localizedPath(service.path), 301)
      }

      const success = request.session.contactFormSent === true
      const error = request.session.contactFormError || null
      delete request.session.contactFormSent
      delete request.session.contactFormError
      const viewConfig = serviceTemplates[service.path]

      if (service.path === '/zimogs/') {
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
          title: locale === 'ru' ? `${service.title} | Laiks Drukāt` : `Zīmogu izgatavošana Jelgavā⚡Ātra izgatavošana | Laiks Drukāt`,
          description: service.teaser,
          service,
          products,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          locale,
          seoImage: service.heroImage || site.meta.defaultShareImage,
          seoType: 'website',
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: service.title,
            description: service.teaser,
            serviceType: service.title,
            areaServed: 'Latvia',
            provider: {
              '@type': 'Organization',
              name: site.company.name,
              url: `${baseUrl}${localizedPath('/')}`,
            },
            image: toAbsoluteUrl(baseUrl, service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${localizedPath(service.path)}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      if (viewConfig) {
        return reply.publicView(viewConfig.page, {
          title: locale === 'ru' ? `${service.title} | Laiks Drukāt` : viewConfig.title,
          description: service.teaser,
          service,
          cart: fastify.getCart(request),
          success,
          error,
          site,
          breadcrumbs,
          locale,
          seoImage: service.heroImage || site.meta.defaultShareImage,
          structuredData: appendStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: service.title,
            description: service.teaser,
            serviceType: service.title,
            areaServed: 'Latvia',
            provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}${localizedPath('/')}` },
            image: toAbsoluteUrl(baseUrl, service.heroImage || site.meta.defaultShareImage),
            url: `${baseUrl}${localizedPath(service.path)}`,
          }, breadcrumbSchema),
          csrf: await reply.generateCsrf(),
        })
      }

      return reply.publicView('pages/services/generic', {
        title: `${service.title} | Laiks Drukāt`,
        description: service.teaser,
        service,
        cart: fastify.getCart(request),
        success,
        error,
        site,
        breadcrumbs,
        locale,
        seoImage: service.heroImage || site.meta.defaultShareImage,
        structuredData: appendStructuredData({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.title,
          description: service.teaser,
          serviceType: service.title,
          areaServed: 'Latvia',
          provider: { '@type': 'Organization', name: site.company.name, url: `${baseUrl}${localizedPath('/')}` },
          image: toAbsoluteUrl(baseUrl, service.heroImage || site.meta.defaultShareImage),
          url: `${baseUrl}${localizedPath(service.path)}`,
        }, breadcrumbSchema),
        csrf: await reply.generateCsrf(),
      })
    })
  }

  fastify.get('/privatuma-politika/', async (request, reply) => {
    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: ui.breadcrumbs.home, path: localizedPath('/') },
      { name: ui.breadcrumbs.privacy, path: localizedPath('/privatuma-politika/') },
    ]
    return reply.publicView('pages/privatuma-politika', {
      title: locale === 'ru' ? 'Политика конфиденциальности | Laiks Drukāt' : 'Privātuma politika | Laiks Drukāt',
      description: locale === 'ru' ? 'Политика конфиденциальности и обработка персональных данных.' : 'Privātuma politika un personas datu apstrāde.',
      cart: fastify.getCart(request),
      site: getLocalizedSite(),
      breadcrumbs,
      locale,
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
    const redirectPage = normalizeContactReturnTo(returnTo)

    // rate limit check
    const rateLimit = getContactRateLimitState(request.ip)
    if (rateLimit.limited) {
      request.session.contactFormError = ui.contact.errors.rateLimit
      return reply.redirect(redirectPage)
    }

    if (!name || !email || !normalizedMessage) {
      request.session.contactFormError = ui.contact.errors.required
      return reply.redirect(redirectPage)
    }

    if (normalizedMessage.length > 180) {
      request.session.contactFormError = ui.contact.errors.length
      return reply.redirect(redirectPage)
    }

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

    await saveContactMessage(entry, fastify.db)

    notifyContactSubmission(fastify, entry)

    recordContactAttempt(request.ip)
    request.session.contactFormSent = true
    return reply.redirect(redirectPage)
  })

}

export default storefrontRoutes




