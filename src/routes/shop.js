import sanitizeHtml from 'sanitize-html'
import {
  appendStructuredData,
  buildBreadcrumbSchema,
  resolvePublicBaseUrl,
  toAbsoluteUrl,
} from '../lib/seo.js'

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  image: true,
  category: {
    select: {
      name: true,
      slug: true,
    },
  },
}

const categoryListSelect = {
  name: true,
  slug: true,
  _count: {
    select: { products: true },
  },
}

const productDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  image: true,
  imprintImage: true,
  stock: true,
  active: true,
  category: {
    select: {
      name: true,
      slug: true,
    },
  },
}

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

  const shouldNoindexListing = (filters) => Boolean(filters.q) || filters.sort !== 'default'

  if (includeListing) {
    // Product listing
    fastify.get('/', async (request, reply) => {
      const baseUrl = resolvePublicBaseUrl()
      const filters = buildShopFilters(request.query)
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Veikals', path: '/veikals/' },
      ]

      const [products, categories] = await Promise.all([
        fastify.db.product.findMany({
          where: filters.where,
          select: productCardSelect,
          orderBy: filters.orderBy,
        }),
        fastify.db.category.findMany({
          select: categoryListSelect,
          orderBy: { name: 'asc' },
        }),
      ])

      return reply.publicView('pages/shop/index', {
        title: 'Zīmogi un zīmogu tintes | Laiks Drukāt veikals ✅',
        description:
          'Zīmogi un zīmogu tintes COLOP ⚡ Izvēlies tieši savu zīmogu vai tinti | Dažādi veidi, augsta kvalitāte un ātra izgatavošana ✓ Pasūti tagad!',
        products,
        categories,
        activeCategory: filters.kategorija,
        q: filters.q,
        sort: filters.sort,
        breadcrumbs,
        robots: shouldNoindexListing(filters)
          ? 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
          : undefined,
        cart: fastify.getCart(request),
        seoImage: products[0]?.image || '/images/web-design/col9p.png',
        structuredData: appendStructuredData({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Laiks Drukāt veikals',
          description: 'Zīmogi un zīmogu tintes Laiks Drukāt e-veikalā.',
          url: `${baseUrl}/veikals/`,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: products.slice(0, 12).map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `${baseUrl}/veikals/${product.slug}/`,
              name: product.name,
            })),
          },
        }, buildBreadcrumbSchema(baseUrl, breadcrumbs)),
        csrf: await reply.generateCsrf(),
      })
    })
  }

  if (includeCategory) {
    // Category page (e.g. /kategorija/zimogi/)
    fastify.get('/kategorija/:slug/', async (request, reply) => {
      const baseUrl = resolvePublicBaseUrl()
      const { slug } = request.params
      const filters = buildShopFilters({ ...request.query, kategorija: slug })

      const category = await fastify.db.category.findUnique({ where: { slug } })
      if (!category) {
        return reply.code(404).view('pages/404', {
          title: '404 | Laiks Drukāt',
          description: 'Lapa netika atrasta.',
          robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
          cart: fastify.getCart(request),
        })
      }

      const [products, categories] = await Promise.all([
        fastify.db.product.findMany({
          where: filters.where,
          select: productCardSelect,
          orderBy: filters.orderBy,
        }),
        fastify.db.category.findMany({
          select: categoryListSelect,
          orderBy: { name: 'asc' },
        }),
      ])
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Veikals', path: '/veikals/' },
        { name: category.name, path: `/kategorija/${category.slug}/` },
      ]

      return reply.publicView('pages/shop/index', {
        title: `${category.name} | Laiks Drukāt ✅`,
        description: `${category.name} kategorija Laiks Drukāt e-veikalā.`,
        products,
        categories,
        activeCategory: slug,
        q: filters.q,
        sort: filters.sort,
        breadcrumbs,
        robots: shouldNoindexListing(filters)
          ? 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
          : undefined,
        cart: fastify.getCart(request),
        seoImage: products[0]?.image || '/images/web-design/col9p.png',
        structuredData: appendStructuredData({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: category.name,
          description: `${category.name} kategorija Laiks Drukāt e-veikalā.`,
          url: `${baseUrl}/kategorija/${category.slug}/`,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: products.slice(0, 12).map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `${baseUrl}/veikals/${product.slug}/`,
              name: product.name,
            })),
          },
        }, buildBreadcrumbSchema(baseUrl, breadcrumbs)),
        csrf: await reply.generateCsrf(),
      })
    })
  }

  if (includeProduct) {
    // Product detail page
    fastify.get('/:slug/', async (request, reply) => {
      const baseUrl = resolvePublicBaseUrl()
      const { slug } = request.params

      const product = await fastify.db.product.findUnique({
        where: { slug },
        select: productDetailSelect,
      })

      if (!product || !product.active) {
        return reply.code(404).view('pages/404', {
          title: '404 | Laiks Drukāt',
          description: 'Lapa netika atrasta.',
          robots: 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
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
          select: productCardSelect,
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
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Veikals', path: '/veikals/' },
        { name: product.category.name, path: `/kategorija/${product.category.slug}/` },
        { name: product.name, path: `/veikals/${product.slug}/` },
      ]

      return reply.publicView('pages/shop/product', {
        title: `${product.name} | Laiks Drukāt`,
        description:
          product.description ||
          `${product.name} kategorijā ${product.category.name} Laiks Drukāt e-veikalā.`,
        product,
        recentlyViewed,
        isStampProduct,
        breadcrumbs,
        cart: fastify.getCart(request),
        seoImage: product.image || product.imprintImage || '/images/web-design/col9p.png',
        seoType: 'product',
        structuredData: appendStructuredData({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description
            ? product.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : `${product.name} kategorijā ${product.category.name} Laiks Drukāt e-veikalā.`,
          image: [product.image, product.imprintImage]
            .filter(Boolean)
            .map((image) => toAbsoluteUrl(baseUrl, image)),
          sku: String(product.id),
          category: product.category.name,
          brand: {
            '@type': 'Brand',
            name: 'Laiks Drukāt',
          },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'EUR',
            price: Number(product.price).toFixed(2),
            availability: product.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: `${baseUrl}/veikals/${product.slug}/`,
            itemCondition: 'https://schema.org/NewCondition',
          },
        }, buildBreadcrumbSchema(baseUrl, breadcrumbs)),
        csrf: await reply.generateCsrf(),
      })
    })
  }
}

export default shopRoutes
