import sanitizeHtml from 'sanitize-html'

async function shopRoutes(fastify, opts = {}) {
  const {
    includeListing = true,
    includeCategory = true,
    includeProduct = true,
  } = opts

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

  if (includeListing) {
    // Product listing
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
        title: 'Zīmogi un zīmogu tintes | Laiks Drukāt veikals ✅',
        description:
          'Zīmogi un zīmogu tintes COLOP ⚡ Izvēlies tieši savu zīmogu vai tinti | Dažādi veidi, augsta kvalitāte un ātra izgatavošana ✓ Pasūti tagad!',
        products,
        categories,
        activeCategory: filters.kategorija,
        q: filters.q,
        sort: filters.sort,
        cart: fastify.getCart(request),
        csrf: await reply.generateCsrf(),
      })
    })
  }

  if (includeCategory) {
    // Category page (e.g. /kategorija/zimogi/)
    fastify.get('/kategorija/:slug/', async (request, reply) => {
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
        title: `${category.name} | Laiks Drukāt ✅`,
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
  }

  if (includeProduct) {
    // Product detail page
    fastify.get('/:slug/', async (request, reply) => {
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

      // Recently viewed products (session-scoped)
      const MAX_VIEWED = 8
      const MAX_RECENT_RENDER = 6

      const sessionViewed = Array.isArray(request.session.viewedProductIds)
        ? request.session.viewedProductIds
        : []

      const currentId = Number(product.id)
      const deduped = sessionViewed
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id !== currentId)

      deduped.unshift(currentId)
      request.session.viewedProductIds = deduped.slice(0, MAX_VIEWED)

      const recentlyViewedIds = request.session.viewedProductIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id !== currentId)
        .slice(0, MAX_RECENT_RENDER)

      let recentlyViewed = []
      if (recentlyViewedIds.length > 0) {
        recentlyViewed = await fastify.db.product.findMany({
          where: {
            active: true,
            id: { in: recentlyViewedIds },
          },
          include: { category: true },
        })

        // Prisma may not preserve the `in: [ids...]` order; reorder manually.
        const orderIndex = new Map(recentlyViewedIds.map((id, i) => [id, i]))
        recentlyViewed.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
      }

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
        recentlyViewed,
        isStampProduct,
        cart: fastify.getCart(request),
        csrf: await reply.generateCsrf(),
      })
    })
  }
}

export default shopRoutes
