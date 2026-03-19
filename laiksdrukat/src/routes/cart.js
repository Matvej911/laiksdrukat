import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

function formatPrice(value) {
  return Number(value).toFixed(2)
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function collectCartForm(request) {
  if (!request.isMultipart || !request.isMultipart()) {
    return { fields: request.body || {}, uploadedFile: null }
  }

  const fields = {}
  let uploadedFile = null
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'stamp-files')
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
      request.server.log.info({ filepath }, 'Saving uploaded stamp file')
      await writeFile(filepath, buffer)

      uploadedFile = {
        originalName: part.filename,
        url: `/uploads/stamp-files/${filename}`,
      }
    } else {
      fields[part.fieldname] = part.value
    }
  }

  return { fields, uploadedFile }
}

async function cartRoutes(fastify) {
  // View cart
  fastify.get('/', async (request, reply) => {
    const cart = await fastify.getValidatedCart(request)

    return reply.view('pages/cart', {
      title: 'Grozs | Laiks Drukāt',
      cart,
      total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    })
  })

  // Add to cart
  fastify.post('/add', async (request, reply) => {
    const { fields, uploadedFile } = await collectCartForm(request)
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

    const derivedDeliveryPrice = deliveryMethod && String(deliveryMethod).toLowerCase().includes('pakom')
      ? 3
      : 0
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
      options['Fails'] = uploadedFile.originalName
      options['Faila saite'] = uploadedFile.url
    }

    const displayName = Object.keys(options).length > 0
      ? `${product.name} — ${Object.entries(options)
          .filter(([key]) => key !== 'Faila saite')
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')}`
      : product.name

    fastify.addToCart(request, product, safeQuantity, {
      options,
      extraPrice,
      displayName,
    })
    return reply.redirect('/grozs')
  })

  // Update quantity
  fastify.post('/update', async (request, reply) => {
    const { lineId, quantity } = request.body
    fastify.updateCartQuantity(request, lineId, Number(quantity))
    return reply.redirect('/grozs')
  })

  // Remove item
  fastify.post('/remove', async (request, reply) => {
    const { lineId } = request.body
    fastify.removeFromCart(request, lineId)
    return reply.redirect('/grozs')
  })
}

export default cartRoutes
