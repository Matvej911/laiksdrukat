import { serviceRouteEntries } from '../content/site.js'

async function storefrontRoutes(fastify) {
  // Homepage
  fastify.get('/', async (request, reply) => {
    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({
        where: { active: true },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      fastify.db.category.findMany({
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return reply.view('pages/home', {
      title: 'Laiks Drukāt | Poligrāfijas un reklāmas pakalpojumi',
      description:
        'Drukas, reklāmas un zīmogu pakalpojumi Jelgavā ar ātrāku Fastify bāzētu mājaslapu.',
      products,
      categories,
      cart: fastify.getCart(request),
    })
  })

  // Contact page
  fastify.get('/kontakti', async (request, reply) => {
    return reply.view('pages/kontakti', {
      title: 'Kontakti | Laiks Drukāt',
      description:
        'Laiks Drukāt kontakti Jelgavā: adrese, tālruņi, e-pasts un Facebook saziņai.',
      cart: fastify.getCart(request),
    })
  })

  for (const route of serviceRouteEntries) {
    fastify.get(route.path, async (request, reply) => {
      if (!route.canonical) {
        return reply.redirect(301, route.service.path)
      }

      return reply.view('partials/service-page', {
        title: `${route.service.title} | Laiks Drukāt`,
        description: route.service.teaser,
        service: route.service,
        cart: fastify.getCart(request),
      })
    })
  }
}

export default storefrontRoutes
