import { readdirSync, readFileSync } from 'fs'
import { extname, join } from 'path'
import { fileURLToPath } from 'url'

const contactAddress = 'Asteru iela 16A, Jelgava, LV-3001'
const currentYear = new Date().getFullYear()
const portfolioImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const galleryMetaFiles = new Set(['_order.json', '_alt.json'])
const isProduction = process.env.NODE_ENV === 'production'
const SITE_CONTENT_TTL_MS = isProduction ? 10 * 60 * 1000 : 5 * 1000

let cachedSiteContent = null
let cachedSiteContentAt = 0

function prettifyPortfolioName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\bscaled\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readGalleryAltMap(dir) {
  try {
    const altMap = JSON.parse(readFileSync(join(dir, '_alt.json'), 'utf8'))
    return altMap && typeof altMap === 'object' && !Array.isArray(altMap) ? altMap : {}
  } catch {
    return {}
  }
}

function readGallery(dirUrl, urlPrefix) {
  try {
    const dir = fileURLToPath(dirUrl)
    const allFiles = readdirSync(dir)
      .filter(f => !galleryMetaFiles.has(f) && portfolioImageExtensions.has(extname(f).toLowerCase()))
    const altMap = readGalleryAltMap(dir)

    let ordered = []
    try {
      const orderFile = JSON.parse(readFileSync(join(dir, '_order.json'), 'utf8'))
      ordered = [
        ...orderFile.filter(f => allFiles.includes(f)),
        ...allFiles.filter(f => !orderFile.includes(f))
      ]
    } catch {
      ordered = allFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }

    return ordered.map(filename => ({
      image: `${urlPrefix}/${filename}`,
      alt: String(altMap[filename] || '').trim() || prettifyPortfolioName(filename),
    }))
  } catch {
    return []
  }
}

export function invalidateSiteContentCache() {
  cachedSiteContent = null
  cachedSiteContentAt = 0
}

const portfolioDir = new URL('../../public/images/portfolio/', import.meta.url)
const vizitkaртesSliderDir = new URL('../../public/images/slider-vizitkartes/', import.meta.url)
const autoGalleryTrack = new URL('../../public/images/car-portfolio/', import.meta.url)

export function getSiteContent() {
  const now = Date.now()
  if (cachedSiteContent && now - cachedSiteContentAt < SITE_CONTENT_TTL_MS) {
    return structuredClone(cachedSiteContent)
  }

  const portfolioItems = readGallery(portfolioDir, '/images/portfolio')
  const vizitkaртesItems = readGallery(vizitkaртesSliderDir, '/images/slider-vizitkartes')
  const autoItems = readGallery(autoGalleryTrack, '/images/car-portfolio')

  const content = {
    portfolioSlider: portfolioItems,
    portfolioSliderVizitki: vizitkaртesItems,
    autoGalleryTrack: autoItems,

  meta: {
    title: 'Laiks Drukāt',
    description:
      `Druka Jelgavā – piedāvājam zīmogus, banerus, uzlīmes, auto aplīmēšanu, kā arī vizītkartes un gaismas kastes | 1000+ projekti ⭐ Kvalitāte ✓ Ātra izpilde 🚀 ${currentYear}`,
    favicon: {
      icon: '',
      svg: '/images/web-design/Laiks LOGOsvg.svg',
      appleTouch: '',
    },
  },
  company: {
    name: 'Laiks Drukāt',
    legalName: 'IU Creative Media',
    registrationNumber: '41702000348',
  },
  contact: {
    address: contactAddress,
    shortAddress: 'Asteru iela 16A, Jelgava',
    mapUrl: 'https://maps.app.goo.gl/e8pYdkmmcthHGNEC7',
    mapEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(contactAddress)}&z=15&output=embed`,
    phones: [
      { label: '+371 29 109 703', href: 'tel:+37129109703' },
      { label: '+371 29 653 300', href: 'tel:+37129653300' },
    ],
    email: 'dp@ml.lv',
    emailHref: 'mailto:dp@ml.lv',
    facebook: {
      label: 'Facebook',
      url: 'https://www.facebook.com/laiksdrukat/',
    },
  },
  home: {
    eyebrow: 'Druka un reklāma Jelgavā',
    title: 'Jūsu idejas – mūsu risinājumi!',
    intro:
      'Kvalitatīvi zīmogi uzņēmumiem un birojiem — plaša izvēle vienuviet',

  
    heroImage: '/images/web-design/col9p.png',
    heroAlt: 'Laiks Drukāt darbi un drukas produkcija',
  },
  shop: {
    intro:
      'Populārākās preces',
    categories: [
      {
        slug: 'zimogi',
        title: 'Zīmogi',
        description: 'Automātiskie COLOP zīmogi, datuma zīmogi, apaļie un kabatas modeļi.',
      },
      {
        slug: 'zimogu-tintes',
        title: 'Zīmogu tintes',
        description: 'Tintes pudelītes un spilventiņi ikdienas lietošanai vai nomaiņai.',
      },
    ],
  },

  services: [
    {
      slug: 'zimogi',
      path: '/zimogs/',
      aliases: ['/zimogs'],
      menuTitle: 'Zīmogi un spiedogi',
      title: 'Zīmogi un spiedogi',
      teaser: `Izgatavojam individuālus zīmogus uzņēmumiem un privātpersonām ⏱ Ātra izpilde un pielāgojami dizaini ✓ Pasūtiet online vai klātienē – ērti un ātri. ${currentYear}`,
      intro:
        'Izgatavojam zīmogus uzņēmumiem, birojiem un ikdienas dokumentu apritei. Piedāvājam populārākos COLOP modeļus, maketa sagatavošanu un iespēju pasūtīt arī tintes.',
      heroAlt: 'COLOP automātiskais zīmogs',
    },
    {
      slug: 'vides-reklama',
      path: '/vides-reklama/',
      aliases: [],
      menuTitle: 'Vides reklāma',
      title: 'Vides reklāma',
      teaser: `⭐ Pamanāma vides reklāma jūsu uzņēmumam ${currentYear} – gaismas kastes, reklāmas burti un izkārtnes. Dizains, izgatavošana un montāža vienuviet. Sazinies ar mums!☎️`,
      heroImage: '/images/web-design/gaismas-kaste.webp',
      heroAlt: 'Gaismas kaste un vides reklāma',
    
    },
    {
      slug: 'vizitkartes',
      path: '/vizitkartes/',
      aliases: [],
      menuTitle: 'Vizītkartes',
      title: 'Vizītkartes',
      teaser: `Vizītkartes⚡Piedāvājam reljefa, sietspiedes un standarta druku |📍Jelgavā | Dažādi formāti, augsta kvalitāte, profesionāls dizains un ātra izgatavošana ✓ ${currentYear}`,
      heroImage: '/images/web-design/vizitkarte-laiksdrukatwebpb.webp', 
      heroAlt: 'Vizītkartes',
    },
    {
      slug: 'baneri',
      path: '/baneri/',
      aliases: [],
      menuTitle: 'Banneri',
      title: 'Banneri',
      teaser: `Roll-up un PVC baneri ⚡ Iekštelpām un āra apstākļiem | Dažādi izmēri, Košas krāsas, izturīgs 440 g/m² materiāls, ātra izgatavošana ✓ Pasūtiet tagad! ${currentYear}`,
      heroImage: '/images/web-design/Banner-LAIKSDR-webp.webp', 
      heroAlt: 'PVC reklāmas banneri',
    },
    {
      slug: 'auto-aplimesana',
      path: '/auto-aplimesana/',
      aliases: [],
      menuTitle: 'Auto aplīmēšana',
      title: 'Auto aplīmēšana',
      teaser: `Auto aplīmēšana Jelgavā sākot no €50 ⚡3M & Oracal vinila plēves – spilgtas krāsas, izturība un ilgstošs rezultāts | Nelieli dizaini tiek uzklāti 1–3h ✓ ${currentYear}`,
      heroImage: '/images/web-design/Van_wepp.webp', 
      heroAlt: 'Auto aplīmēšana',
    },
    {
      slug: 'uzlimes',
      path: '/uzlimes/',
      aliases: [],
      menuTitle: 'Uzlīmes',
      title: 'Uzlīmes',
      teaser: `Ruļļu, UV un lielformāta uzlīmes⚡Piemērotas iepakojumam un reklāmai | Krāsaino uzlīmju cena no 19 €/m² ✓ Dažādi izmēri un tirāžas | Sazinies un saņem cenu ${currentYear}`,
      heroImage: '/images/web-design/uzlimes_laiks_webp.webp', 
      heroAlt: 'Uzlīmes un etiķetes',
    },
    {
      slug: 'druka',
      path: '/druka/',
      aliases: ['/poligrafija'],
      menuTitle: 'Bukleti, brošūras, flajeri',
      title: 'Bukleti, brošūras, flajeri un citi drukas materiāli',
      teaser: 'Drukas pakalpojumi Jelgavā – bukleti, brošūras, plakāti ar pilnu dizaina izstrādi un failu sagatavošana drukai | No idejas līdz gatavam rezultātam ✓',
      heroImage: 'images/web-design/reklamas-materialu-druka_small.webp', 
      heroAlt: 'Bukleti un drukas materiāli',
      
    },
  ],
   
}

  content.portfolio = content.services
    .filter(service => service.slug !== 'zimogi')
    .map(service => ({
      image: service.heroImage,
      title: service.title,
      path: service.path
    }))

  cachedSiteContent = content
  cachedSiteContentAt = now

  return structuredClone(content)
}


export const siteContent = getSiteContent()

export const serviceBySlug = Object.fromEntries(
  siteContent.services.map((service) => [service.slug, service]),
)

export const serviceRouteEntries = siteContent.services.flatMap((service) => [
  { path: service.path, service, canonical: true },
  ...service.aliases.map((alias) => ({ path: alias, service, canonical: false })),
])


