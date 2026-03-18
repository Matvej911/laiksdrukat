import fp from 'fastify-plugin'

// Cart is stored in session as:
// session.cart = [ { lineId, productId, name, price, quantity, image, options } ]

function buildLineId(productId, optionKey, extraPrice) {
  const raw = `${productId}:${optionKey}:${extraPrice}`
  let hash = 0

  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash |= 0
  }

  return `${productId}-${Math.abs(hash)}`
}

async function cartPlugin(fastify) {
  fastify.decorate('getCart', (request) => {
    return request.session.cart || []
  })

  fastify.decorate('addToCart', (request, product, quantity = 1, meta = {}) => {
    const options = meta.options || {}
    const optionKey = JSON.stringify(options)
    const extraPrice = Number(meta.extraPrice || 0)
    const lineId = meta.lineId || buildLineId(product.id, optionKey, extraPrice)
    const unitPrice = Number(product.price) + extraPrice
    const displayName = meta.displayName || product.name
    const cart = request.session.cart || []
    const existing = cart.find((item) => item.lineId === lineId)

    if (existing) {
      existing.quantity += quantity
    } else {
      cart.push({
        lineId,
        productId: product.id,
        name: product.name,
        displayName,
        price: unitPrice,
        basePrice: Number(product.price),
        extraPrice,
        image: product.image,
        quantity,
        options,
        })
    }
    request.session.cart = cart
  })

  fastify.decorate('removeFromCart', (request, lineId) => {
    const cart = request.session.cart || []
    request.session.cart = cart.filter((item) => item.lineId !== lineId)
  })

  fastify.decorate('updateCartQuantity', (request, lineId, quantity) => {
    const cart = request.session.cart || []
    const item = cart.find((cartItem) => cartItem.lineId === lineId)
    if (item) {
      if (quantity <= 0) {
        request.session.cart = cart.filter((cartItem) => cartItem.lineId !== lineId)
      } else {
        item.quantity = quantity
        request.session.cart = cart
      }
    }
  })

  fastify.decorate('clearCart', (request) => {
    request.session.cart = []
  })

  fastify.decorate('cartTotal', (request) => {
    const cart = request.session.cart || []
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  })
}

export default fp(cartPlugin)
