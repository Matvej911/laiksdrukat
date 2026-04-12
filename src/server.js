import Fastify from 'fastify'
import FastifyView from '@fastify/view'
import FastifyStatic from '@fastify/static'
import FastifyFormbody from '@fastify/formbody'
import FastifyMultipart from '@fastify/multipart'
import FastifyCookie from '@fastify/cookie'
import FastifySession from '@fastify/session'
import FastifyCsrf from '@fastify/csrf-protection'
import FastifyHelmet from '@fastify/helmet'
import FastifyCompress from '@fastify/compress'
import { Eta } from 'eta'
import { fileURLToPath } from 'url'
import { join, dirname, extname } from 'path'
import 'dotenv/config'

import dbPlugin from './plugins/db.js'
import cartPlugin from './plugins/cart.js'
import authPlugin from './plugins/auth.js'
import { siteContent, getSiteContent } from './content/site.js'

import storefrontRoutes from './routes/storefront.js'
import sitemapRoutes from './routes/sitemap.js'
import shopRoutes from './routes/shop.js'
import cartRoutes from './routes/cart.js'
import checkoutRoutes from './routes/checkout.js'
import adminRoutes from './routes/admin/index.js'
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in .env')
}

console.log('BOOT OK', { port: process.env.PORT, host: process.env.HOST })

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'
const trustProxy = process.env.TRUST_PROXY
  ? ['1', 'true', 'yes', 'on'].includes(process.env.TRUST_PROXY.toLowerCase())
  : isProduction
const publicAppUrl = process.env.APP_URL?.trim()
  || `http://localhost:${process.env.PORT || 3000}`
const secureCookies = isProduction && publicAppUrl.startsWith('https://')
const assetVersion = process.env.ASSET_VERSION?.trim()
  || String(Math.floor(Date.now() / 1000))
const longCacheAssetExtensions = new Set([
  '.avif',
  '.webp',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.ico',
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
])
const SLOW_REQUEST_THRESHOLD_MS = 500
const HIGH_CONCURRENCY_THRESHOLD = 20
 
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://www.clarity.ms',
      'https://scripts.clarity.ms',
      'https://googleads.g.doubleclick.net',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://ssl.google-analytics.com',
    ],
    scriptSrcElem: [
      "'self'",
      "'unsafe-inline'",
      'https://www.clarity.ms',
      'https://scripts.clarity.ms',
      'https://googleads.g.doubleclick.net',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://ssl.google-analytics.com',
    ],
    scriptSrcAttr: [
      "'unsafe-inline'",
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https:',
    ],
    fontSrc: [
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
    ],
    connectSrc: [
      "'self'",
      'https://www.clarity.ms',
      'https://c.clarity.ms',
      'https://n.clarity.ms',
      'https://www.google.com',
      'https://www.googletagmanager.com',
      'https://region1.analytics.google.com',
      'https://www.google-analytics.com',
      'https://ssl.google-analytics.com',
      'https://stats.g.doubleclick.net',
    ],
    frameSrc: [
      "'self'",
      'https://www.googletagmanager.com',
      'https://www.google.com',
      'https://www.google.com/maps',
    ],
    upgradeInsecureRequests: isProduction ? [] : null,
  },
}

const fastify = Fastify({
  logger: true,
  trustProxy,
})
let inFlightRequests = 0
let peakInFlightRequests = 0
let shuttingDown = false

function finalizeRequestMetrics(request) {
  if (!request.requestMetrics || request.requestMetrics.completed) {
    return null
  }

  request.requestMetrics.completed = true
  inFlightRequests = Math.max(0, inFlightRequests - 1)
  return request.requestMetrics
}

fastify.addHook('onRequest', async (request) => {
  inFlightRequests += 1
  peakInFlightRequests = Math.max(peakInFlightRequests, inFlightRequests)
  request.requestMetrics = {
    startedAt: Date.now(),
    inFlightAtStart: inFlightRequests,
    peakInFlightAtRequest: peakInFlightRequests,
    completed: false,
  }

  if (inFlightRequests >= HIGH_CONCURRENCY_THRESHOLD) {
    fastify.log.warn({
      route: request.raw.url,
      method: request.method,
      inFlightRequests,
      peakInFlightRequests,
    }, 'High concurrency detected')
  }
})

fastify.addHook('onResponse', async (request, reply) => {
  const metrics = finalizeRequestMetrics(request)
  if (!metrics) {
    return
  }

  const durationMs = Date.now() - metrics.startedAt
  if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
    fastify.log.warn({
      route: request.raw.url,
      method: request.method,
      statusCode: reply.statusCode,
      durationMs,
      inFlightAtStart: metrics.inFlightAtStart,
      inFlightNow: inFlightRequests,
      peakInFlightRequests,
    }, 'Slow request detected')
  }
})

fastify.addHook('onError', async (request, reply, error) => {
  const metrics = finalizeRequestMetrics(request)
  fastify.log.error({
    err: error,
    route: request.raw.url,
    method: request.method,
    statusCode: reply.statusCode,
    durationMs: metrics ? Date.now() - metrics.startedAt : null,
    inFlightNow: inFlightRequests,
    peakInFlightRequests,
  }, 'Request failed')
})

fastify.addHook('onTimeout', async (request) => {
  const metrics = finalizeRequestMetrics(request)
  fastify.log.error({
    route: request.raw.url,
    method: request.method,
    durationMs: metrics ? Date.now() - metrics.startedAt : null,
    inFlightNow: inFlightRequests,
    peakInFlightRequests,
  }, 'Request timed out')
})

fastify.decorateReply('publicView', function publicView(page, data = {}) {
  const canonicalBase = publicAppUrl.replace(/\/+$/, '')
  const requestPath = new URL(this.request.raw.url || '/', 'http://localhost').pathname
  const canonicalUrl = data.canonicalUrl || new URL(requestPath, `${canonicalBase}/`).toString()

  return this.view(page, {
    ...data,
    canonicalUrl,
  })
})

if (isProduction) {
  fastify.addHook('onRequest', async (request, reply) => {
    const forwardedHostHeader = request.headers['x-forwarded-host']
    const rawHostHeader = Array.isArray(forwardedHostHeader)
      ? forwardedHostHeader[0]
      : forwardedHostHeader || request.headers.host || ''

    const normalizedHost = String(rawHostHeader)
      .split(',')[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '')

    if (normalizedHost === 'laiksdrukat.lv') {
      return reply.redirect(`https://www.laiksdrukat.lv${request.raw.url || '/'}`, 301)
    }
  })
}



// Template engine (Eta)
await fastify.register(FastifyView, {
  engine: { eta: new Eta() },
  root: join(__dirname, 'views'),
  viewExt: 'eta',
  defaultContext: {
    siteName: siteContent.company.name,
    currentYear: new Date().getFullYear(),
    site: siteContent,
    siteUrl: publicAppUrl.replace(/\/+$/, ''),
    isProduction,
    assetVersion,
  },
})

await fastify.register(sitemapRoutes)

await fastify.register(FastifyHelmet, {
  contentSecurityPolicy,
})

await fastify.register(FastifyCompress, {
  global: true,
  encodings: ['br', 'gzip', 'deflate'],
})

// Static files
await fastify.register(FastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/',
  cacheControl: true,
  immutable: true,
  maxAge: '30d',
  setHeaders(res, filepath) {
    const extension = extname(filepath).toLowerCase()

    if (longCacheAssetExtensions.has(extension)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
      return
    }

    res.setHeader('Cache-Control', 'public, max-age=3600')
  },
})

// Body parsing
await fastify.register(FastifyFormbody)
await fastify.register(FastifyMultipart, {
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
})


// Cookies + session
await fastify.register(FastifyCookie)
await fastify.register(FastifySession, {
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: secureCookies,
    httpOnly: true,
    sameSite: 'lax',
  },
  saveUninitialized: false,
})

await fastify.register(FastifyCsrf, {
  sessionPlugin: '@fastify/session'
})



// Custom plugins
await fastify.register(dbPlugin)
await fastify.register(cartPlugin)
await fastify.register(authPlugin)

// Routes
await fastify.register(storefrontRoutes)
await fastify.register(shopRoutes, {
  prefix: '/veikals/',
  includeListing: true,
  includeCategory: false,
  includeProduct: true,
})
await fastify.register(shopRoutes, {
  includeListing: false,
  includeCategory: true,
  includeProduct: false,
})
await fastify.register(cartRoutes, { prefix: '/grozs/' })
await fastify.register(checkoutRoutes, { prefix: '/pasutijums/' })
await fastify.register(adminRoutes, { prefix: '/admin' })

fastify.setNotFoundHandler(async (request, reply) => {
  return reply.code(404).view('pages/404', {
    title: '404 | Laiks Drukāt',
    description: 'Lapa netika atrasta.',
    robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    breadcrumbs: [
      { name: 'Sākums', path: '/' },
      { name: '404' },
    ],
    cart: fastify.getCart(request),
  })
})

async function shutdown(signal, error = null) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  if (error) {
    fastify.log.error({ err: error, signal }, 'Fatal process event')
  } else {
    fastify.log.warn({ signal }, 'Received shutdown signal')
  }

  try {
    await fastify.close()
    fastify.log.info({ signal }, 'Fastify shutdown completed')
  } catch (closeError) {
    fastify.log.error({ err: closeError, signal }, 'Fastify shutdown failed')
  } finally {
    process.exit(error ? 1 : 0)
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})

process.on('uncaughtException', (error) => {
  shutdown('uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  shutdown('unhandledRejection', error)
})

// Start server
try {
  await fastify.listen({
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
  })
  console.log(`\n🚀 Laiks Drukāt server running on ${publicAppUrl}\n`)
} catch (err) {
  console.error(err)
  fastify.log.error(err)
  process.exit(1)
}
