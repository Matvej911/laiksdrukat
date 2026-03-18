import bcrypt from 'bcrypt'

async function adminRoutes(fastify) {
  // Login page
  fastify.get('/login', async (request, reply) => {
    if (request.session.adminId) return reply.redirect('/admin')
    return reply.view('admin/login', { title: 'Admin | Laiks Drukāt', error: null })
  })

  // Login submit
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body

    const user = await fastify.db.adminUser.findUnique({ where: { username } })
    if (!user) {
      return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return reply.view('admin/login', { title: 'Admin', error: 'Nepareizs lietotājvārds vai parole.' })
    }

    request.session.adminId = user.id
    return reply.redirect('/admin')
  })

  // Logout
  fastify.post('/logout', async (request, reply) => {
    request.session.destroy()
    return reply.redirect('/admin/login')
  })

  // Dashboard
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const [productCount, orderCount, pendingOrders, recentOrders] = await Promise.all([
      fastify.db.product.count(),
      fastify.db.order.count(),
      fastify.db.order.count({ where: { status: 'PENDING' } }),
      fastify.db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
    ])

    return reply.view('admin/dashboard', {
      title: 'Admin | Dashboard',
      productCount,
      orderCount,
      pendingOrders,
      recentOrders,
    })
  })

  // --- PRODUCTS ---

  fastify.get('/products', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const products = await fastify.db.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.view('admin/products', { title: 'Admin | Produkti', products })
  })

  fastify.get('/products/new', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', { title: 'Jauns produkts', product: null, categories, error: null })
  })

  fastify.post('/products/new', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { name, slug, description, price, stock, categoryId, active } = request.body
    try {
      await fastify.db.product.create({
        data: {
          name, slug, description,
          price: parseFloat(price),
          stock: parseInt(stock),
          categoryId: parseInt(categoryId),
          active: active === 'on',
        },
      })
      return reply.redirect('/admin/products')
    } catch (err) {
      const categories = await fastify.db.category.findMany()
      return reply.view('admin/product-form', {
        title: 'Jauns produkts', product: null, categories,
        error: 'Kļūda saglabājot produktu. Pārbaudiet vai slug ir unikāls.'
      })
    }
  })

  fastify.get('/products/:id/edit', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const product = await fastify.db.product.findUnique({ where: { id: Number(request.params.id) } })
    const categories = await fastify.db.category.findMany()
    return reply.view('admin/product-form', { title: 'Rediģēt produktu', product, categories, error: null })
  })

  fastify.post('/products/:id/edit', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { name, slug, description, price, stock, categoryId, active } = request.body
    await fastify.db.product.update({
      where: { id: Number(request.params.id) },
      data: {
        name, slug, description,
        price: parseFloat(price),
        stock: parseInt(stock),
        categoryId: parseInt(categoryId),
        active: active === 'on',
      },
    })
    return reply.redirect('/admin/products')
  })

  fastify.post('/products/:id/delete', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await fastify.db.product.delete({ where: { id: Number(request.params.id) } })
    return reply.redirect('/admin/products')
  })

  // --- ORDERS ---

  fastify.get('/orders', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const orders = await fastify.db.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return reply.view('admin/orders', { title: 'Admin | Pasūtījumi', orders })
  })

  fastify.get('/orders/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const order = await fastify.db.order.findUnique({
      where: { id: Number(request.params.id) },
      include: { items: { include: { product: true } } },
    })
    return reply.view('admin/order-detail', { title: `Pasūtījums #${order.id}`, order })
  })

  fastify.post('/orders/:id/status', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await fastify.db.order.update({
      where: { id: Number(request.params.id) },
      data: { status: request.body.status },
    })
    return reply.redirect(`/admin/orders/${request.params.id}`)
  })
}

export default adminRoutes
