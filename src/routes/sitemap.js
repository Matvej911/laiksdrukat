// routes/sitemap.js
import { XMLBuilder } from 'fast-xml-parser'
import { getSiteContent } from '../content/site.js'

function normalizeImageUrl(baseUrl, value) {
  if (!value) return null
  return value.startsWith('http') ? value : `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`
}

async function sitemapRoutes(fastify) {
  fastify.get('/sitemap.xml', async (request, reply) => {
    const baseUrl = 'https://www.laiksdrukat.lv'
    const site = getSiteContent()

    // GET DATA FROM DB
    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({ where: { active: true } }),
      fastify.db.category.findMany(),
    ])

    const urls = []

    // STATIC PAGES
    urls.push({
      loc: `${baseUrl}/`,
      priority: 1.0,
      image: normalizeImageUrl(baseUrl, site.home.heroImage || site.meta.defaultShareImage),
    })
    urls.push({ loc: `${baseUrl}/veikals/`, priority: 0.9, image: normalizeImageUrl(baseUrl, site.meta.defaultShareImage) })
    urls.push({ loc: `${baseUrl}/kontakti/`, priority: 0.7 })
    urls.push({ loc: `${baseUrl}/privatuma-politika/`, priority: 0.4 })

    site.services.forEach((service) => {
      urls.push({
        loc: `${baseUrl}${service.path}`,
        priority: 0.9,
        image: normalizeImageUrl(baseUrl, service.heroImage || site.meta.defaultShareImage),
      })
    })

    // CATEGORIES
    categories.forEach(cat => {
      urls.push({
        loc: `${baseUrl}/kategorija/${cat.slug}/`,
        priority: 0.8,
        image: normalizeImageUrl(baseUrl, site.meta.defaultShareImage),
      })
    })

    // PRODUCTS
    products.forEach(p => {
      urls.push({
        loc: `${baseUrl}/veikals/${p.slug}/`,
        priority: 0.7,
        image: normalizeImageUrl(baseUrl, p.image),
      })
    })

    // BUILD XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    })

    const xml = builder.build({
      urlset: {
        '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
        '@_xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1',
        url: urls.map(u => ({
          loc: u.loc,
          priority: u.priority,
          ...(u.image
            ? {
                'image:image': {
                  'image:loc': u.image,
                },
              }
            : {}),
        })),
      },
    })

    reply.header('Content-Type', 'application/xml')
    return xml
  })
}

export default sitemapRoutes
