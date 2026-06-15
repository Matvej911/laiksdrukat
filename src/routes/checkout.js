import { randomUUID } from 'node:crypto'
import {
  sendCustomerOrderConfirmation,
  sendOwnerOrderNotification,
} from '../lib/mailer.js'
import { buildBreadcrumbSchema, resolvePublicBaseUrl } from '../lib/seo.js'
import { getCheckoutTotals, getOmnivaDeliveryFee, getStoredOrderTotals } from '../lib/shipping.js'
import { resolveUploadPath } from '../lib/uploads.js'
import { getOmnivaLockerGroups } from '../lib/omniva-lockers.js'

const CHECKOUT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const CHECKOUT_RATE_LIMIT_MAX = 5
const checkoutAttempts = new Map()

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

function getCheckoutRateLimitState(ip) {
  const attempts = getActiveAttempts(checkoutAttempts, ip, CHECKOUT_RATE_LIMIT_WINDOW_MS)

  return {
    attempts,
    remaining: Math.max(0, CHECKOUT_RATE_LIMIT_MAX - attempts.length),
    limited: attempts.length >= CHECKOUT_RATE_LIMIT_MAX,
  }
}

function recordCheckoutAttempt(ip) {
  const now = Date.now()
  const attempts = getActiveAttempts(checkoutAttempts, ip, CHECKOUT_RATE_LIMIT_WINDOW_MS)
  attempts.push(now)
  checkoutAttempts.set(ip, attempts)
}

function notifyOrderEmails(fastify, { order, cart, attachments }) {
  setImmediate(async () => {
    try {
      const ownerResult = await sendOwnerOrderNotification({
        order,
        cart,
        attachments,
        db: fastify.db,
      })

      if (!ownerResult.sent) {
        fastify.log.warn({ reason: ownerResult.reason, orderId: order.id }, 'Owner order notification email was not sent')
      }

      const customerResult = await sendCustomerOrderConfirmation({
        order,
        cart,
      })

      if (!customerResult.sent) {
        fastify.log.warn({ reason: customerResult.reason, orderId: order.id }, 'Customer order confirmation email was not sent')
      }
    } catch (error) {
      fastify.log.error({ error, orderId: order.id }, 'Failed to send order emails')
    }
  })
}

function buildCheckoutViewModel(subtotalExVat, deliveryType = 'pickup') {
  return {
    total: subtotalExVat,
    ...getCheckoutTotals(subtotalExVat, deliveryType),
  }
}

async function checkoutRoutes(fastify) {
  const omnivaLockerGroups = getOmnivaLockerGroups()

  // Checkout form
  fastify.get('/', async (request, reply) => {
    const startedAt = Date.now()
    const cart = await fastify.getValidatedCart(request)
    if (cart.length === 0) {
      fastify.log.info({
        route: '/pasutijums/',
        items: 0,
        redirectedTo: '/grozs/',
        durationMs: Date.now() - startedAt,
      }, 'Route timing')
      return reply.redirect('/grozs/')
    }
    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Grozs', path: '/grozs/' },
      { name: 'Pasūtījums', path: '/pasutijums/' },
    ]
    const total = await fastify.validatedCartTotal(request)
    const checkoutTotals = buildCheckoutViewModel(total)

    fastify.log.info({
      route: '/pasutijums/',
      items: cart.length,
      total,
      durationMs: Date.now() - startedAt,
    }, 'Route timing')

    return reply.publicView('pages/checkout', {
      title: 'Checkout | Laiks Drukāt',
      robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
      breadcrumbs,
      cart,
      ...checkoutTotals,
      omnivaLockerGroups,
      csrf: await reply.generateCsrf(),
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })

  // Place order
  fastify.post('/', { preHandler: fastify.csrfProtection }, async (request, reply) => {
    const cart = await fastify.getValidatedCart(request)
    if (cart.length === 0) return reply.redirect('/grozs/')
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Grozs', path: '/grozs/' },
      { name: 'Pasūtījums', path: '/pasutijums/' },
    ]
    const checkoutBreadcrumbs = buildBreadcrumbSchema(resolvePublicBaseUrl(), breadcrumbs)

    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      zip,
      note,
      paymentMethod,
      deliveryType,
    } = request.body
    
    const needsAddress = deliveryType === 'omniva'
    const cartTotal = await fastify.validatedCartTotal(request)
    const checkoutTotals = buildCheckoutViewModel(cartTotal, deliveryType || 'pickup')

    if (!firstName || !lastName || !email || (needsAddress && !address)) {
      return reply.publicView('pages/checkout', {
        title: 'Checkout | Laiks Drukāt',
        robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
        breadcrumbs,
        cart,
        ...checkoutTotals,
        error: 'Lūdzu aizpildiet visus obligātos laukus.',
        formData: request.body,
        omnivaLockerGroups,
        csrf: await reply.generateCsrf(),
        structuredData: checkoutBreadcrumbs,
      })
    }

    const rateLimit = getCheckoutRateLimitState(request.ip)
    if (rateLimit.limited) {
      return reply.publicView('pages/checkout', {
        title: 'Checkout | Laiks Drukāt',
        robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
        breadcrumbs,
        cart,
        ...checkoutTotals,
        error: 'Pārāk daudz pasūtījumu no šīs IP adreses. Lūdzu mēģiniet vēlreiz pēc stundas.',
        formData: request.body,
        omnivaLockerGroups,
        csrf: await reply.generateCsrf(),
        structuredData: checkoutBreadcrumbs,
      })
    }

    const deliveryFee = getOmnivaDeliveryFee(cartTotal)
    const appliedDeliveryFee = deliveryType === 'omniva' ? deliveryFee : 0
    const total = cartTotal + appliedDeliveryFee
    const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
    const noteParts = [note]

    if (paymentMethod) {
      noteParts.unshift(`Maksājuma veids: ${paymentMethod}`)
    }
    if (deliveryType === 'omniva') {
      const lockerParts = [address, city, zip].filter(Boolean)
      const deliveryLabel = appliedDeliveryFee === 0 ? '(bezmaksas)' : '(+3,50 €)'
      noteParts.unshift(`Piegāde: Omniva pakomāts ${deliveryLabel} — ${lockerParts.join(', ')}`)
    } else {
      noteParts.unshift(`Piegāde: Saņem birojā (Asteru iela 16A, Jelgava)`)
    }

    const order = await fastify.db.order.create({
      data: {
        publicId: randomUUID(),
        name,
        email,
        phone: phone || null,
        address: address || null,
        city: city || null,
        zip: zip || null,
        note: noteParts.filter(Boolean).join('\n') || null,
        total,
        items: {
          create: cart.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity, 
            options: item.options || {},
          })),
        },
      },
      include: {
        items: true,
      },
    })

    for (const item of order.items) {
      const uploadToken = item.options && typeof item.options === 'object'
        ? item.options.__uploadToken
        : null

      if (typeof uploadToken === 'string' && uploadToken.trim()) {
        await fastify.db.upload.updateMany({
          where: { token: uploadToken },
          data: { sourceRef: `orderItem:${item.id}` },
        })
      }
    }

    recordCheckoutAttempt(request.ip)

    const uploadTokens = new Set()
    for (const item of cart) {
      const token = item?.options && typeof item.options === 'object'
        ? item.options.__uploadToken
        : null
      if (typeof token === 'string' && token.trim()) {
        uploadTokens.add(token.trim())
      }
    }

    const attachments = []
    if (uploadTokens.size > 0) {
      const uploads = await fastify.db.upload.findMany({
        where: {
          token: { in: [...uploadTokens] },
          isPrivate: true,
        },
        select: {
          token: true,
          originalName: true,
          relativePath: true,
        },
      })

      for (const upload of uploads) {
        const filepath = resolveUploadPath(upload.relativePath)
        attachments.push({
          filename: upload.originalName,
          path: filepath,
        })
      }
    }

    notifyOrderEmails(fastify, { order, cart, attachments })

    fastify.clearCart(request)

    return reply.redirect(`/pasutijums/paldies/${order.publicId}`)
  })

  // Legacy thank you redirect
  fastify.get('/paldies/', async (request, reply) => {
    const { order: orderId } = request.query
    if (!orderId) {
      return reply.redirect('/veikals/')
    }

    const numericId = Number.parseInt(orderId, 10)
    const order = await fastify.db.order.findFirst({
      where: {
        OR: [
          { publicId: String(orderId) },
          ...(Number.isFinite(numericId) ? [{ id: numericId }] : []),
        ],
      },
      select: { publicId: true },
    })

    if (!order) {
      return reply.redirect('/veikals/')
    }

    return reply.redirect(`/pasutijums/paldies/${order.publicId}`)
  })

  // Thank you page
  fastify.get('/paldies/:publicId', async (request, reply) => {
    const order = await fastify.db.order.findUnique({
      where: { publicId: request.params.publicId },
      include: { items: true },
    })

    if (!order) {
      return reply.redirect('/veikals/')
    }

    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Grozs', path: '/grozs/' },
      { name: 'Pasūtījums', path: '/pasutijums/' },
      { name: 'Paldies', path: `/pasutijums/paldies/${order.publicId}` },
    ]
    return reply.publicView('pages/thankyou', {
      title: 'Paldies! | Laiks Drukāt',
      robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
      breadcrumbs,
      order,
      cart: fastify.getCart(request),
      pricing: getStoredOrderTotals(order),
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })
}

export default checkoutRoutes
