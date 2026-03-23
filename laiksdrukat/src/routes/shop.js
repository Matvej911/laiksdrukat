import sanitizeHtml from 'sanitize-html'

async function shopRoutes(fastify) {
  const buildShopFilters = (query = {}) => {
    const q = typeof query.q === 'string' ? query.q.trim() : ''
    const sort = typeof query.sort === 'string' ? query.sort : 'default'
    const kategorija = typeof query.kategorija === 'string' ? query.kategorija : null

    const where = { active: true }

    if (kategorija) {
      where.category = { slug: kategorija }
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
      ]
    }

    let orderBy = { sortOrder: 'asc' }
    if (sort === 'name-asc') orderBy = { name: 'asc' }
    if (sort === 'price-asc') orderBy = { price: 'asc' }
    if (sort === 'price-desc') orderBy = { price: 'desc' }

    return { q, sort, kategorija, where, orderBy }
  }

  // Product listing (all or by category)
  fastify.get('/', async (request, reply) => {
    const filters = buildShopFilters(request.query)

    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({
        where: filters.where,
        include: { category: true },
        orderBy: filters.orderBy,
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


    return reply.view('pages/shop/index', {
      title: 'Veikals | Laiks Drukāt',
      description:
        'Laiks Drukāt e-veikals ar COLOP zīmogiem un zīmogu tintēm.',
      products,
      categories,
      activeCategory: filters.kategorija,
      q: filters.q,
      sort: filters.sort,
      cart: fastify.getCart(request),
      csrf: await reply.generateCsrf(),
    })
  })

  // Category page (e.g. /veikals/kategorija/zimogi)
  fastify.get('/kategorija/:slug', async (request, reply) => {
    const { slug } = request.params
    const filters = buildShopFilters({ ...request.query, kategorija: slug })

    const category = await fastify.db.category.findUnique({ where: { slug } })
    if (!category) {
      return reply.code(404).view('pages/404', {
        title: '404 | Laiks Drukāt',
        description: 'Lapa netika atrasta.',
        cart: fastify.getCart(request),
      })
    }

    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({
        where: filters.where,
        include: { category: true },
        orderBy: filters.orderBy,
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

    return reply.view('pages/shop/index', {
      title: `${category.name} | Laiks Drukāt`,
      description: `${category.name} kategorija Laiks Drukāt e-veikalā.`,
      products,
      categories,
      activeCategory: slug,
      q: filters.q,
      sort: filters.sort,
      cart: fastify.getCart(request),
      csrf: await reply.generateCsrf(),
    })
  })

  // Product detail page
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params

    const product = await fastify.db.product.findUnique({
      where: { slug },
      include: { category: true },
    })

    if (!product || !product.active) {
      return reply.code(404).view('pages/404', {
        title: '404 | Laiks Drukāt',
        description: 'Lapa netika atrasta.',
        cart: fastify.getCart(request),
      })
    }
    const isStampProduct = product.category.slug === 'zimogi'

    // Related products from same category
    const related = await fastify.db.product.findMany({
      where: {
        active: true,
        categoryId: product.categoryId,
        NOT: { id: product.id },
      },
      take: 4,
    })

    
    if (product.description) {
        product.description = sanitizeHtml(
          product.description
            .replace(/\s*data-draftjs-conductor-fragment=(?:"[^"]*"|&quot;.*?&quot;)/g, '')
            .replace(/<div>\s*<\/div>/g, '')
            .trim(),
          {
            allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'span', 'div'],
            allowedAttributes: {
              'a': ['href', 'target', 'rel'],
              'span': ['style'],
              'div': ['style'],
            },
            allowedSchemes: ['http', 'https', 'mailto'],
          }
        )
      }

    return reply.view('pages/shop/product', {
      title: `${product.name} | Laiks Drukāt`,
      description:
        product.description ||
        `${product.name} kategorijā ${product.category.name} Laiks Drukāt e-veikalā.`,
      product,
      related,
      isStampProduct,
      cart: fastify.getCart(request),
      csrf: await reply.generateCsrf(),
    })
  })
}

export default shopRoutes
