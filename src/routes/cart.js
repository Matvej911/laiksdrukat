import { basename, extname, join } from 'path'

import { hasValidSessionCsrf } from '../lib/csrf.js'
import { buildBreadcrumbSchema, resolvePublicBaseUrl } from '../lib/seo.js'
import {
  contentTypeFromFilename,
  persistUpload,
  resolveUploadPath,
  sendStoredFile,
  validateDocumentOrImageUpload,
} from '../lib/uploads.js'

async function collectCartForm(request) {
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

      const ext = extname(part.filename).toLowerCase() || '.bin'
      const buffer = await part.toBuffer()

      if (buffer.length === 0) continue

      if (!validateDocumentOrImageUpload(buffer, ext)) {
        request.server.log.warn({ filename: part.filename }, 'Rejected invalid stamp upload')
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
      subdir: 'stamp-files',
      originalName: file.originalName,
      buffer: file.buffer,
      urlPrefix: '/fails',
    })

    uploadedFile = {
      originalName: file.originalName,
      filename: stored.filename,
      path: stored.filepath,
      relativePath: stored.relativePath,
      size: stored.size,
      url: stored.url,
    }
  }

  return { fields, uploadedFile, invalidCsrf: false }
}

async function cartRoutes(fastify) {
  fastify.get('/stamp-files/:filename', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const filename = basename(String(request.params.filename || ''))
    const filepath = join(resolveUploadPath('stamp-files'), filename)

    try {
      return await sendStoredFile(reply, filepath, filename, { forceDownload: true })
    } catch (error) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send('File not found')
      }
      throw error
    }
  })

  // View cart
  fastify.get('/', async (request, reply) => {
    const cart = await fastify.getValidatedCart(request)
    const baseUrl = resolvePublicBaseUrl()
    const breadcrumbs = [
      { name: 'Sākums', path: '/' },
      { name: 'Grozs', path: '/grozs/' },
    ]

    return reply.publicView('pages/cart', {
      title: 'Grozs | Laiks Drukāt',
      robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
      breadcrumbs,
      cart,
      total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      csrf: await reply.generateCsrf(),
      structuredData: buildBreadcrumbSchema(baseUrl, breadcrumbs),
    })
  })

  // Add to cart
  fastify.post('/add', async (request, reply) => {
    const { fields, uploadedFile, invalidCsrf } = await collectCartForm(request)
    if (invalidCsrf) {
      return reply.code(403).send('Invalid CSRF token')
    }

    const {
      productId,
      quantity = 1,
      inkColor,
      deliveryMethod,
      deliveryAddress,
      stampText,
    } = fields

    const product = await fastify.db.product.findUnique({
      where: { id: Number(productId) },
    })

    if (!product || !product.active) {
      return reply.code(404).send('Product not found')
    }

    if (product.stock <= 0) {
      return reply.code(400).send('Product is out of stock')
    }

    const derivedDeliveryPrice = 0
    const extraPrice = Number(derivedDeliveryPrice || 0)
    const parsedQuantity = Number.parseInt(quantity, 10)
    const safeQuantity = Math.max(1, Math.min(Number.isFinite(parsedQuantity) ? parsedQuantity : 1, product.stock))
    const options = {}

    if (inkColor) {
      options['Nospieduma tintes krāsa'] = inkColor
    }

    if (deliveryMethod) {
      options['Preces saņemšana'] = extraPrice > 0
        ? `${deliveryMethod} + ${formatPrice(extraPrice)} €`
        : deliveryMethod
    }

    if (deliveryAddress && String(deliveryAddress).trim()) {
      options.Adrese = String(deliveryAddress).trim()
    }

    if (stampText && String(stampText).trim()) {
      options['Teksts zīmogam'] = String(stampText).trim()
    }

    if (uploadedFile) {
      const upload = await fastify.db.upload.create({
        data: {
          sourceType: 'STAMP_ORDER',
          sourceRef: `session:${request.session.sessionId || 'unknown'}`,
          originalName: uploadedFile.originalName,
          storedName: uploadedFile.filename,
          subdir: 'stamp-files',
          relativePath: uploadedFile.relativePath,
          mimeType: contentTypeFromFilename(uploadedFile.originalName),
          size: uploadedFile.size,
          isPrivate: true,
        },
      })

      options['Fails'] = uploadedFile.originalName
      options['Faila saite'] = `/fails/${upload.token}`
      options['__uploadToken'] = upload.token
    }

    const displayName = Object.keys(options).length > 0
      ? `${product.name} — ${Object.entries(options)
          .filter(([key]) => key !== 'Faila saite' && !key.startsWith('__'))
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')}`
      : product.name

    fastify.addToCart(request, product, safeQuantity, {
      options,
      extraPrice,
      displayName,
    })
    return reply.redirect('/grozs/')
  })

  // Update quantity
  fastify.post('/update', { preHandler: fastify.csrfProtection }, async (request, reply) => {
    const { lineId, quantity } = request.body
    fastify.updateCartQuantity(request, lineId, Number(quantity))
    return reply.redirect('/grozs/')
  })

  // Remove item
  fastify.post('/remove', { preHandler: fastify.csrfProtection }, async (request, reply) => {
    const { lineId } = request.body
    fastify.removeFromCart(request, lineId)
    return reply.redirect('/grozs/')
  })
}

export default cartRoutes
