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
import { join, dirname } from 'path'
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
const canonicalAppUrl = (() => {
  try {
    return new URL(publicAppUrl)
  } catch {
    return null
  }
})()
const bareRedirectHost = canonicalAppUrl?.hostname.startsWith('www.')
  ? canonicalAppUrl.hostname.slice(4).toLowerCase()
  : null
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
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://ssl.google-analytics.com',
    ],
    scriptSrcElem: [
      "'self'",
      "'unsafe-inline'",
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
      'https://www.googletagmanager.com',
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

if (isProduction && canonicalAppUrl && bareRedirectHost) {
  fastify.addHook('onRequest', async (request, reply) => {
    const forwardedHost = typeof request.headers['x-forwarded-host'] === 'string'
      ? request.headers['x-forwarded-host'].split(',')[0].trim()
      : ''
    const requestHost = (forwardedHost || request.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase()

    if (requestHost !== bareRedirectHost) {
      return
    }

    const targetUrl = new URL(request.raw.url || '/', canonicalAppUrl.origin)
    return reply.redirect(301, targetUrl.toString())
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
  immutable: isProduction,
  maxAge: isProduction ? '30d' : 0,
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
    cart: fastify.getCart(request),
  })
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
