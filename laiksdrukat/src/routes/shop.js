async function shopRoutes(fastify) {
  // Product listing (all or by category)
  fastify.get('/', async (request, reply) => {
    const { kategorija } = request.query

    const where = { active: true }
    if (kategorija) {
      where.category = { slug: kategorija }
    }

    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
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
      activeCategory: kategorija || null,
      cart: fastify.getCart(request),
    })
  })

  // Category page (e.g. /veikals/kategorija/zimogi)
  fastify.get('/kategorija/:slug', async (request, reply) => {
    const { slug } = request.params

    const category = await fastify.db.category.findUnique({ where: { slug } })
    if (!category) return reply.code(404).send('Category not found')

    const products = await fastify.db.product.findMany({
      where: { active: true, categoryId: category.id },
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    const categories = await fastify.db.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return reply.view('pages/shop/index', {
      title: `${category.name} | Laiks Drukāt`,
      description: `${category.name} kategorija Laiks Drukāt e-veikalā.`,
      products,
      categories,
      activeCategory: slug,
      cart: fastify.getCart(request),
    })
  })

  // Product detail page
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params

    const product = await fastify.db.product.findUnique({
      where: { slug },
      include: { category: true },
    })

    if (!product || !product.active) return reply.code(404).send('Product not found')

    // Related products from same category
    const related = await fastify.db.product.findMany({
      where: {
        active: true,
        categoryId: product.categoryId,
        NOT: { id: product.id },
      },
      take: 4,
    })

    return reply.view('pages/shop/product', {
      title: `${product.name} | Laiks Drukāt`,
      description:
        product.description ||
        `${product.name} kategorijā ${product.category.name} Laiks Drukāt e-veikalā.`,
      product,
      related,
      cart: fastify.getCart(request),
    })
  })
}

export default shopRoutes
