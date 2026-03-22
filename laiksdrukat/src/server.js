import Fastify from 'fastify'
import FastifyView from '@fastify/view'
import FastifyStatic from '@fastify/static'
import FastifyFormbody from '@fastify/formbody'
import FastifyMultipart from '@fastify/multipart'
import FastifyCookie from '@fastify/cookie'
import FastifySession from '@fastify/session'
import { Eta } from 'eta'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import 'dotenv/config'

import dbPlugin from './plugins/db.js'
import cartPlugin from './plugins/cart.js'
import authPlugin from './plugins/auth.js'
import { siteContent, getSiteContent } from './content/site.js'

import storefrontRoutes from './routes/storefront.js'
import shopRoutes from './routes/shop.js'
import cartRoutes from './routes/cart.js'
import checkoutRoutes from './routes/checkout.js'
import adminRoutes from './routes/admin/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: true })

// Template engine (Eta)
await fastify.register(FastifyView, {
  engine: { eta: new Eta() },
  root: join(__dirname, 'views'),
  viewExt: 'eta',
  defaultContext: {
    siteName: siteContent.company.name,
    currentYear: new Date().getFullYear(),
    site: siteContent,
  },
})

// Static files
await fastify.register(FastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/',
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
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  cookie: { secure: false }, // set to true in production with HTTPS
  saveUninitialized: false,
})

// Custom plugins
await fastify.register(dbPlugin)
await fastify.register(cartPlugin)
await fastify.register(authPlugin)

// Routes
await fastify.register(storefrontRoutes)
await fastify.register(shopRoutes, { prefix: '/veikals' })
await fastify.register(cartRoutes, { prefix: '/grozs' })
await fastify.register(checkoutRoutes, { prefix: '/checkout' })
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
  console.log(`\n🚀 Laiks Drukāt server running on http://localhost:${process.env.PORT || 3000}\n`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
