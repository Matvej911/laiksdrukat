// routes/sitemap.js
import { XMLBuilder } from 'fast-xml-parser'

async function sitemapRoutes(fastify) {
  fastify.get('/sitemap.xml', async (request, reply) => {
    const baseUrl = 'https://www.laiksdrukat.lv'

    // GET DATA FROM DB
    const [products, categories] = await Promise.all([
      fastify.db.product.findMany({ where: { active: true } }),
      fastify.db.category.findMany(),
    ])

    const urls = []

    // STATIC PAGES
    urls.push({ loc: `${baseUrl}/`, priority: 1.0 })
    urls.push({ loc: `${baseUrl}/veikals/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/kontakti/`, priority: 0.7 })
    urls.push({ loc: `${baseUrl}/privatuma-politika/`, priority: 0.4 })
    urls.push({ loc: `${baseUrl}/auto-aplimesana/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/vizitkartes/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/druka/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/baneri/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/uzlimes/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/vides-reklama/`, priority: 0.9 })
    urls.push({ loc: `${baseUrl}/zimogs/`, priority: 0.9 })

    // CATEGORIES
    categories.forEach(cat => {
      urls.push({
        loc: `${baseUrl}/kategorija/${cat.slug}/`,
        priority: 0.8,
      })
    })

    // PRODUCTS
    products.forEach(p => {
      urls.push({
        loc: `${baseUrl}/veikals/${p.slug}/`,
        priority: 0.7,
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
        url: urls.map(u => ({
          loc: u.loc,
          priority: u.priority,
        })),
      },
    })

    reply.header('Content-Type', 'application/xml')
    return xml
  })
}

export default sitemapRoutes