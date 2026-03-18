async function cartRoutes(fastify) {
  // View cart
  fastify.get('/', async (request, reply) => {
    return reply.view('pages/cart', {
      title: 'Grozs | Laiks Drukāt',
      cart: fastify.getCart(request),
      total: fastify.cartTotal(request),
    })
  })

  // Add to cart
  fastify.post('/add', async (request, reply) => {
    const { productId, quantity = 1 } = request.body

    const product = await fastify.db.product.findUnique({
      where: { id: Number(productId) },
    })

    if (!product || !product.active) {
      return reply.code(404).send('Product not found')
    }

    fastify.addToCart(request, product, Number(quantity))
    return reply.redirect('/grozs')
  })

  // Update quantity
  fastify.post('/update', async (request, reply) => {
    const { productId, quantity } = request.body
    fastify.updateCartQuantity(request, Number(productId), Number(quantity))
    return reply.redirect('/grozs')
  })

  // Remove item
  fastify.post('/remove', async (request, reply) => {
    const { productId } = request.body
    fastify.removeFromCart(request, Number(productId))
    return reply.redirect('/grozs')
  })
}

export default cartRoutes
