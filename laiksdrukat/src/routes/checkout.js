import {
  sendCustomerOrderConfirmation,
  sendOwnerOrderNotification,
} from '../lib/mailer.js'

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
    } = request.body

    if (!firstName || !lastName || !email || !address || !city || !zip) {
      return reply.view('pages/checkout', {
        title: 'Checkout | Laiks Drukāt',
        cart,
        total: fastify.cartTotal(request),
        error: 'Lūdzu aizpildiet visus obligātos laukus.',
        formData: request.body,
      })
    }

    const total = fastify.cartTotal(request)
    const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
    const noteParts = [note]

    if (paymentMethod) {
      noteParts.unshift(`Maksājuma veids: ${paymentMethod}`)
    }

    const order = await fastify.db.order.create({
      data: {
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
            name: item.displayName || item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
    })

    try {
      const ownerResult = await sendOwnerOrderNotification({
        order,
        cart,
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
      fastify.log.error(error, 'Failed to send order emails')
    }

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
