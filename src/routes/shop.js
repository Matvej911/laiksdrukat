import sanitizeHtml from 'sanitize-html'
import {
  appendStructuredData,
  buildBreadcrumbSchema,
  resolvePublicBaseUrl,
  toAbsoluteUrl,
} from '../lib/seo.js'
import { getOrSetCache } from '../lib/runtime-cache.js'

const SHOP_PAGE_SIZE = 24
const SHOP_LIST_CACHE_TTL_MS = 30 * 1000
const SHOP_CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000
const legacyProductSlugRedirects = new Map([
  ['printer-c10-compact', 'colop-c10-compact'],
])

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

  const getPageNumber = (query = {}) => {
    const rawPage = Number.parseInt(String(query.page || '1'), 10)
    return Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  }

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

  const buildPaginationItems = (currentPage, totalPages) => {
    if (totalPages <= 1) {
      return []
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
    return [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b)
  }

  const buildPaginationUrl = (pathname, filters, page) => {
    const params = new URLSearchParams()

    if (filters.q) {
      params.set('q', filters.q)
    }

    if (filters.sort && filters.sort !== 'default') {
      params.set('sort', filters.sort)
    }

    if (page > 1) {
      params.set('page', String(page))
    }

    const queryString = params.toString()
    return queryString ? `${pathname}?${queryString}` : pathname
  }

  const getShopCategories = async (db) => {
    const { value } = await getOrSetCache('shop:categories', SHOP_CATEGORY_CACHE_TTL_MS, async () => (
      Promise.all([
        db.category.findMany({
          select: categoryListSelect,
          orderBy: { name: 'asc' },
        }),
        db.product.count({
          where: { active: true },
        }),
      ]).then(([categories, allProductsCount]) => ({
        categories,
        allProductsCount,
      }))
    ))

    return value
  }

  const getListingData = async (db, filters, page) => {
    const cacheKey = JSON.stringify({
      scope: 'listing',
      q: filters.q,
      sort: filters.sort,
      kategorija: filters.kategorija,
      page,
    })

    return getOrSetCache(cacheKey, SHOP_LIST_CACHE_TTL_MS, async () => {
      const totalProducts = await db.product.count({ where: filters.where })
      const totalPages = Math.max(1, Math.ceil(totalProducts / SHOP_PAGE_SIZE))
      const currentPage = Math.min(page, totalPages)
      const skip = (currentPage - 1) * SHOP_PAGE_SIZE

      const products = await db.product.findMany({
        where: filters.where,
        select: productCardSelect,
        orderBy: filters.orderBy,
        skip,
        take: SHOP_PAGE_SIZE,
      })

      return {
        products,
        totalProducts,
        totalPages,
        currentPage,
        pageSize: SHOP_PAGE_SIZE,
      }
    })
  }

  if (includeListing) {
    // Product listing
    fastify.get('/', async (request, reply) => {
      const startedAt = Date.now()
      const baseUrl = resolvePublicBaseUrl()
      const filters = buildShopFilters(request.query)
      const requestedPage = getPageNumber(request.query)
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Veikals', path: '/veikals/' },
      ]

      const [listingResult, categoryData] = await Promise.all([
        getListingData(fastify.db, filters, requestedPage),
        getShopCategories(fastify.db),
      ])
      const {
        hit: cacheHit,
        value: {
          products,
          totalProducts,
          totalPages,
          currentPage,
          pageSize,
        },
      } = listingResult
      const { categories, allProductsCount } = categoryData
      const paginationPath = '/veikals/'

      fastify.log.info({
        route: '/veikals/',
        cacheHit,
        q: filters.q || null,
        sort: filters.sort,
        page: currentPage,
        totalProducts,
        returnedProducts: products.length,
        durationMs: Date.now() - startedAt,
      }, 'Route timing')

      return reply.publicView('pages/shop/index', {
        title: 'Zīmogi un zīmogu tintes | Laiks Drukāt veikals ✅',
        description:
          'Zīmogi un zīmogu tintes COLOP ⚡ Izvēlies tieši savu zīmogu vai tinti | Dažādi veidi, augsta kvalitāte un ātra izgatavošana ✓ Pasūti tagad!',
        products,
        categories,
        allProductsCount,
        activeCategory: filters.kategorija,
        q: filters.q,
        sort: filters.sort,
        currentPage,
        totalPages,
        totalProducts,
        pageSize,
        pagination: {
          currentPage,
          totalPages,
          totalProducts,
          items: buildPaginationItems(currentPage, totalPages),
          prevUrl: currentPage > 1 ? buildPaginationUrl(paginationPath, filters, currentPage - 1) : null,
          nextUrl: currentPage < totalPages ? buildPaginationUrl(paginationPath, filters, currentPage + 1) : null,
          buildUrl: (page) => buildPaginationUrl(paginationPath, filters, page),
        },
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
      })
    })
  }

  if (includeCategory) {
    // Category page (e.g. /kategorija/zimogi/)
    fastify.get('/kategorija/:slug/', async (request, reply) => {
      const startedAt = Date.now()
      const baseUrl = resolvePublicBaseUrl()
      const { slug } = request.params
      const requestedPage = getPageNumber(request.query)
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

      const [listingResult, categoryData] = await Promise.all([
        getListingData(fastify.db, filters, requestedPage),
        getShopCategories(fastify.db),
      ])
      const {
        hit: cacheHit,
        value: {
          products,
          totalProducts,
          totalPages,
          currentPage,
          pageSize,
        },
      } = listingResult
      const { categories, allProductsCount } = categoryData
      const breadcrumbs = [
        { name: 'Sākums', path: '/' },
        { name: 'Veikals', path: '/veikals/' },
        { name: category.name, path: `/kategorija/${category.slug}/` },
      ]
      const paginationPath = `/kategorija/${category.slug}/`

      fastify.log.info({
        route: '/veikals/kategorija/',
        category: category.slug,
        cacheHit,
        q: filters.q || null,
        sort: filters.sort,
        page: currentPage,
        totalProducts,
        returnedProducts: products.length,
        durationMs: Date.now() - startedAt,
      }, 'Route timing')

      return reply.publicView('pages/shop/index', {
        title: `${category.name} | Laiks Drukāt ✅`,
        description: `${category.name} kategorija Laiks Drukāt e-veikalā.`,
        products,
        categories,
        allProductsCount,
        activeCategory: slug,
        q: filters.q,
        sort: filters.sort,
        currentPage,
        totalPages,
        totalProducts,
        pageSize,
        pagination: {
          currentPage,
          totalPages,
          totalProducts,
          items: buildPaginationItems(currentPage, totalPages),
          prevUrl: currentPage > 1 ? buildPaginationUrl(paginationPath, filters, currentPage - 1) : null,
          nextUrl: currentPage < totalPages ? buildPaginationUrl(paginationPath, filters, currentPage + 1) : null,
          buildUrl: (page) => buildPaginationUrl(paginationPath, filters, page),
        },
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
      })
    })
  }

  if (includeProduct) {
    // Product detail page
    fastify.get('/:slug/', async (request, reply) => {
      const startedAt = Date.now()
      const baseUrl = resolvePublicBaseUrl()
      const requestedSlug = String(request.params.slug || '')
      const redirectSlug = legacyProductSlugRedirects.get(requestedSlug)

      if (redirectSlug) {
        fastify.log.info({
          route: '/veikals/:slug/',
          slug: requestedSlug,
          redirectedTo: redirectSlug,
          durationMs: Date.now() - startedAt,
        }, 'Route timing')
        return reply.redirect(`/veikals/${redirectSlug}/`, 301)
      }

      const slug = requestedSlug

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

      fastify.log.info({
        route: '/veikals/:slug/',
        slug: product.slug,
        productId: product.id,
        category: product.category.slug,
        recentlyViewed: recentlyViewed.length,
        durationMs: Date.now() - startedAt,
      }, 'Route timing')

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
