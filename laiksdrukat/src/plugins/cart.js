import fp from 'fastify-plugin'

// Cart is stored in session as:
// session.cart = [ { productId, name, price, quantity, image } ]

async function cartPlugin(fastify) {
  fastify.decorate('getCart', (request) => {
    return request.session.cart || []
  })

  fastify.decorate('addToCart', (request, product, quantity = 1) => {
    const cart = request.session.cart || []
    const existing = cart.find(i => i.productId === product.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        image: product.image,
        quantity,
      })
    }
    request.session.cart = cart
  })

  fastify.decorate('removeFromCart', (request, productId) => {
    const cart = request.session.cart || []
    request.session.cart = cart.filter(i => i.productId !== productId)
  })

  fastify.decorate('updateCartQuantity', (request, productId, quantity) => {
    const cart = request.session.cart || []
    const item = cart.find(i => i.productId === productId)
    if (item) {
      if (quantity <= 0) {
        request.session.cart = cart.filter(i => i.productId !== productId)
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
    return cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  })
}

export default fp(cartPlugin)
