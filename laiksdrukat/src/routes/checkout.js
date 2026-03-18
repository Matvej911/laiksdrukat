async function checkoutRoutes(fastify) {
  // Checkout form
  fastify.get('/', async (request, reply) => {
    const cart = fastify.getCart(request)
    if (cart.length === 0) return reply.redirect('/grozs')

    return reply.view('pages/checkout', {
      title: 'Checkout | Laiks Drukāt',
      cart,
      total: fastify.cartTotal(request),
    })
  })

  // Place order
  fastify.post('/', async (request, reply) => {
    const cart = fastify.getCart(request)
    if (cart.length === 0) return reply.redirect('/grozs')

    const { name, email, phone, address, city, zip, note } = request.body

    if (!name || !email) {
      return reply.view('pages/checkout', {
        title: 'Checkout | Laiks Drukāt',
        cart,
        total: fastify.cartTotal(request),
        error: 'Lūdzu aizpildiet visus obligātos laukus.',
        formData: request.body,
      })
    }

    const total = fastify.cartTotal(request)

    const order = await fastify.db.order.create({
      data: {
        name,
        email,
        phone: phone || null,
        address: address || null,
        city: city || null,
        zip: zip || null,
        note: note || null,
        total,
        items: {
          create: cart.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
    })

    fastify.clearCart(request)

    return reply.redirect(`/checkout/paldies?order=${order.id}`)
  })

  // Thank you page
  fastify.get('/paldies', async (request, reply) => {
    const { order: orderId } = request.query

    const order = orderId
      ? await fastify.db.order.findUnique({
          where: { id: Number(orderId) },
          include: { items: true },
        })
      : null

    return reply.view('pages/thankyou', {
      title: 'Paldies! | Laiks Drukāt',
      order,
      cart: fastify.getCart(request),
    })
  })
}

export default checkoutRoutes
