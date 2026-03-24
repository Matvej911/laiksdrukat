import { readdirSync, readFileSync } from 'fs'
import { extname, join } from 'path'
import { fileURLToPath } from 'url'

const contactAddress = 'Asteru iela 16A, Jelgava, LV-3001'

const portfolioImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg'])

function prettifyPortfolioName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\bscaled\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readGallery(dirUrl, urlPrefix) {
  try {
    const dir = fileURLToPath(dirUrl)
    const allFiles = readdirSync(dir)
      .filter(f => f !== '_order.json' && portfolioImageExtensions.has(extname(f).toLowerCase()))

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
      alt: prettifyPortfolioName(filename),
    }))
  } catch {
    return []
  }
}

const portfolioDir = new URL('../../public/images/portfolio/', import.meta.url)
const vizitkaртesSliderDir = new URL('../../public/images/slider-vizitkartes/', import.meta.url)
const autoGalleryTrack = new URL('../../public/images/car-portfolio/', import.meta.url)

export function getSiteContent() {
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
      'Drukas, reklāmas un zīmogu pakalpojumi Jelgavā. Zīmogi, banneri, auto aplīmēšana, uzlīmes, vizītkartes un citi drukas darbi.',
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
      teaser: 'COLOP automātiskie zīmogi, datuma zīmogi un populārākās tintes vienuviet.',
      intro:
        'Izgatavojam zīmogus uzņēmumiem, birojiem un ikdienas dokumentu apritei. Piedāvājam populārākos COLOP modeļus, maketa sagatavošanu un iespēju pasūtīt arī tintes.',
      heroImage: 'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/col9p-300x300.png',
      heroAlt: 'COLOP automātiskais zīmogs',
      highlights: [
        { value: 'COLOP', label: 'populāri modeļi e-veikalā' },
        { value: '6 EUR+', label: 'sākuma cenas vienkāršiem modeļiem' },
        { value: 'Apaļi / datuma / kabatas', label: 'vairāki formāti' },
      ],
      offerings: [
        {
          title: 'Uzņēmumu zīmogi',
          text: 'Automātiskie taisnstūra zīmogi ikdienas dokumentiem, rekvizītiem un parakstu laukumiem.',
        },
        {
          title: 'Datuma un speciālie zīmogi',
          text: 'Modeļi ar datumu, teksta laukiem vai individuāliem pielāgojumiem noliktavai un birojam.',
        },
        {
          title: 'Tintes un piederumi',
          text: 'Papildinām zīmogu pasūtījumus ar tintēm un spilventiņiem, lai sistēma būtu gatava darbam uzreiz.',
        },
      ],
      details: [
        'Sagatavojam vienkāršu maketu pēc jūsu rekvizītiem un logotipa.',
        'Palīdzam izvēlēties izmēru pēc teksta daudzuma un paredzētā lietojuma.',
        'Veikala sadaļa paredzēta biežāk pasūtītajiem zīmogu modeļiem un tintēm.',
      ],
      pricing: [
        { title: 'Standarta modeļi', text: 'Populārākajiem zīmogu modeļiem cenas sākas aptuveni no 6 EUR un pieaug atkarībā no izmēra un mehānisma.' },
        { title: 'Individuāli risinājumi', text: 'Apaļiem, lielākiem vai ar īpašu maketu sagatavotiem zīmogiem cenu precizējam pēc vajadzības.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/col9p-300x300.png',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/1745849318844-scaled.jpg',
      ],
    },
    {
      slug: 'vides-reklama',
      path: '/vides-reklama/',
      aliases: [],
      menuTitle: 'Vides reklāma',
      title: 'Vides reklāma',
      teaser: 'Plāksnes, gaismas kastes, norādes un fasādes vizuālie risinājumi.',
      intro:
        'Veidojam noturīgus vides reklāmas risinājumus uzņēmumu fasādēm, telpām un apkārtējai videi. No vienkāršām plāksnēm līdz gaismas kastēm un norāžu sistēmām.',
      heroImage: '/images/web-design/gaismas-kaste.webp',
      heroAlt: 'Gaismas kaste un vides reklāma',
      highlights: [
        { value: 'Fasādes', label: 'plāksnes un uzraksti' },
        { value: 'Norādes', label: 'iekšdarbiem un ārā' },
        { value: 'Gaismas kastes', label: 'redzamībai dienā un vakarā' },
      ],
      offerings: [
        {
          title: 'Fasādes plāksnes',
          text: 'Kompozītmateriāla, PVC vai citu materiālu plāksnes ar uzņēmuma nosaukumu un darba laiku.',
        },
        {
          title: 'Gaismas kastes',
          text: 'Risinājumi veikalu skatlogiem un fasādēm, lai uzņēmums būtu labi pamanāms arī tumšajā laikā.',
        },
        {
          title: 'Norāžu sistēmas',
          text: 'Kabinetu, stāvu, teritoriju un apkalpošanas punktu marķējumi skaidrai orientācijai.',
        },
      ],
      details: [
        'Palīdzam piemeklēt materiālu atbilstoši novietojumam un ekspluatācijas apstākļiem.',
        'Pieskaņojam dizainu esošajai zīmolvedībai un telpas arhitektūrai.',
        'Atsevišķos projektos iespējams apvienot plāksnes, uzlīmes un drukas materiālus vienotā sistēmā.',
      ],
      pricing: [
        { title: 'Projekta cena', text: 'Cena ir atkarīga no izmēra, materiāla, stiprinājuma un montāžas sarežģītības.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/483989033_122109836724781710_5683284030057054303_n.jpg',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/IMG_1668-scaled.jpg',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/1756443787080-scaled.jpg',
      ],
    },
    {
      slug: 'vizitkartes',
      path: '/vizitkartes/',
      aliases: [],
      menuTitle: 'Vizītkartes',
      title: 'Vizītkartes',
      teaser: 'Standarta, laminētas un izteiksmīgas vizītkartes ar piemērotu apdari.',
      intro:
        'Izgatavojam vizītkartes dažādām vajadzībām, sākot no vienkāršām ikdienas kartēm līdz premium variantiem ar lamināciju vai īpašu papīru.',
      heroImage: '/images/web-design/vizitkarte-laiksdrukatwebpb.webp',
      heroAlt: 'Vizītkartes',
      highlights: [
        { value: '1 vai 2 puses', label: 'drukas iespējas' },
        { value: 'Matēts / glancēts / soft-touch', label: 'laminācijas varianti' },
        { value: 'Standarta un premium', label: 'papīra izvēles' },
      ],
      offerings: [
        {
          title: 'Standarta vizītkartes',
          text: 'Klasiski izmēri un skaidra informācijas struktūra ikdienas lietošanai.',
        },
        {
          title: 'Premium materiāli',
          text: 'Teksturēts papīrs, krāsaināks iespaids un niansēta apdare reprezentablākam rezultātam.',
        },
        {
          title: 'Pēcapstrāde',
          text: 'Pieejamas laminācijas un citi apdares risinājumi, lai karte kalpotu ilgāk un izskatītos pārliecinošāk.',
        },
      ],
      details: [
        'Vizītkartes varam sagatavot vienpusējas vai abpusējas.',
        'Palīdzam salikt informāciju tā, lai karte būtu viegli nolasāma un profesionāla.',
        'Ja vajag, vienlaikus varam pieskaņot arī uzlīmes, plāksnes un citus drukas materiālus.',
      ],
      pricing: [
        { title: 'Cena pēc tirāžas', text: 'Vizītkaršu cenu nosaka tirāža, papīrs, apdare un maketa sarežģītība.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/skrejjjj.png',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/uiig_pages-to-jpg-0001-scaled.jpg',
      ],
    },
    {
      slug: 'baneri',
      path: '/baneri/',
      aliases: [],
      menuTitle: 'Banneri',
      title: 'Banneri',
      teaser: 'PVC banneri, reklāmas audumi un gatavie risinājumi āra un iekštelpu reklāmai.',
      intro:
        'Drukājam bannerus uzņēmumu fasādēm, akcijām, pasākumiem un informācijas izvietošanai. Piedāvājam piemērotu materiālu, apmales un stiprinājumu risinājumus.',
      heroImage: '/images/web-design/Banner-LAIKSDR-webp.webp',
      heroAlt: 'PVC reklāmas banneri',
      highlights: [
        { value: 'PVC un citi materiāli', label: 'pielāgoti izmēram un vietai' },
        { value: 'Iekštelpām un ārā', label: 'īslaicīgiem un ilgtermiņa darbiem' },
        { value: 'Apdare un stiprinājumi', label: 'gatavs uzstādīšanai' },
      ],
      offerings: [
        {
          title: 'Akciju un veikalu banneri',
          text: 'Skatlogiem, tirdzniecības vietām un sezonas piedāvājumiem.',
        },
        {
          title: 'Pasākumu banneri',
          text: 'Risinājumi izstādēm, sporta pasākumiem, koncertiem un prezentācijām.',
        },
        {
          title: 'Lielformāta reklāma',
          text: 'Banneri lielām sienām, fasādēm un nožogojumiem ar skaidri salasāmu ziņu.',
        },
      ],
      details: [
        'Izvēlamies piemērotu materiālu atkarībā no lietošanas vietas un apgaismojuma.',
        'Palīdzam sagatavot maketu arī tad, ja ir tikai logo, teksts un aptuvena ideja.',
        'Varam pieskaņot bannerus citām kampaņas vienībām, piemēram, uzlīmēm vai plāksnēm.',
      ],
      pricing: [
        { title: 'Cena pēc izmēra', text: 'Banneru cenu galvenokārt nosaka izmērs, materiāls, apdare un nepieciešamā montāža.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/slider/cache/a5c6479da819cb4d73ad077bca5799d5/averbaneri-scaled.jpg',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/1756443787080-scaled.jpg',
      ],
    },
    {
      slug: 'auto-aplimesana',
      path: '/auto-aplimesana/',
      aliases: [],
      menuTitle: 'Auto aplīmēšana',
      title: 'Auto aplīmēšana',
      teaser: 'No vienkāršiem uzrakstiem līdz pilnai transporta reklāmas aplīmēšanai.',
      intro:
        'Piedāvājam auto aplīmēšanu ar reklāmas plēvēm, kas palīdz uzņēmumam būt pamanāmam ikdienā. Veidojam gan nelielus elementus, gan pilnus vizuālos risinājumus transportam.',
      heroImage: '/images/web-design/Van_wepp.webp',
      heroAlt: 'Auto aplīmēšana',
      highlights: [
        { value: '3M / Oracal', label: 'plēves materiāli' },
        { value: 'No pāris stundām', label: 'vienkāršiem darbiem' },
        { value: '50 EUR+', label: 'maziem uzrakstiem un elementiem' },
      ],
      offerings: [
        {
          title: 'Daļēja aplīmēšana',
          text: 'Logo, kontaktinformācija, sānu uzraksti, logu elementi un citi mērķēti reklāmas punkti.',
        },
        {
          title: 'Pilna aplīmēšana',
          text: 'Plašāka vizuālā identitāte visam auto vai lielai tā daļai, lai reklāma būtu pamanāma no katra skatpunkta.',
        },
        {
          title: 'Speciāli risinājumi',
          text: 'Katram transportlīdzeklim pielāgots dizains un plēvju izvēle atkarībā no virsmas un lietojuma.',
        },
      ],
      details: [
        'Izmantojam kvalitatīvas 3M un Oracal plēves.',
        'Vienkāršākus darbus iespējams izpildīt aptuveni 3-4 stundās.',
        'Rūpīgi piemeklējam risinājumu, lai auto reklāma izskatītos precīza un profesionāla.',
      ],
      pricing: [
        { title: 'Atsevišķi elementi', text: 'Mazāki uzraksti un atsevišķi elementi parasti sākas aptuveni no 50 EUR.' },
        { title: 'Vieglie auto', text: 'Pilna vai plaša vieglā auto aplīmēšana bieži iekrīt aptuveni 300-650 EUR robežās.' },
        { title: 'Kravas transports', text: 'Lielākiem transportlīdzekļiem budžets var sasniegt aptuveni 1000-2000 EUR atkarībā no apjoma.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2024/07/IMG_20240706_182833-scaled.jpg',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/1745849318844-scaled.jpg',
      ],
    },
    {
      slug: 'uzlimes',
      path: '/uzlimes/',
      aliases: [],
      menuTitle: 'Uzlīmes',
      title: 'Uzlīmes',
      teaser: 'Etiķetes, termouzlīmes, krāsainas un lielformāta uzlīmes dažādiem pielietojumiem.',
      intro:
        'Ražojam uzlīmes produktiem, iepakojumam, vitrīnām un reklāmai. Pieejamas gan vienkāršas termouzlīmes, gan izturīgākas materiālu etiķetes un lielformāta uzlīmes.',
      heroImage: '/images/web-design/uzlimes_laiks_webp.webp',
      heroAlt: 'Uzlīmes un etiķetes',
      highlights: [
        { value: '5-15 EUR', label: 'dizaina izstrāde vienkāršām etiķetēm' },
        { value: '19-20 EUR/m²', label: 'krāsainas uzlīmes no plēves' },
        { value: '28 EUR/m²', label: 'lielformāta UV druka' },
      ],
      offerings: [
        {
          title: 'Termouzlīmes ruļļos',
          text: 'Pašlīmējošas termouzlīmes svaru, sastāvu, svītrkodu vai citu produktu datu norādei.',
        },
        {
          title: 'Krāsainas uzlīmes',
          text: 'Zīmola, logo un informatīvās uzlīmes no plēves vai citiem materiāliem.',
        },
        {
          title: 'Lielformāta uzlīmes',
          text: 'Vitrīnām, sienām, transportam un citiem reklāmas nesējiem ar izteiktu vizuālo efektu.',
        },
      ],
      details: [
        'Pieejami materiāli ar semigloss virsmu, ar roku aizpildāmiem laukumiem un izturīgāki wax-resin varianti.',
        'Termouzlīmju lietošanas temperatūras diapazons atkarībā no materiāla var sasniegt aptuveni no -20 līdz +50 grādiem.',
        'Vienkāršas uzlīmju dizaina izstrādes izmaksas parasti ir aptuveni 5-15 EUR.',
      ],
      pricing: [
        { title: 'Krāsainas uzlīmes', text: 'Parastās krāsainās uzlīmes no plēves orientējoši sākas ap 19-20 EUR/m².' },
        { title: 'UV lielformāts', text: 'Lielformāta uzlīmes ar UV druku orientējoši sākas ap 28 EUR/m².' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/Uzlmes-jebkdam-mrim.png',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/uzlimesa-png.webp',
      ],
    },
    {
      slug: 'druka',
      path: '/druka/',
      aliases: ['/poligrafija'],
      menuTitle: 'Bukleti, brošūras, flajeri',
      title: 'Bukleti, brošūras, flajeri un citi drukas materiāli',
      teaser: 'No vienkāršiem flajeriem līdz biezākām brošūrām un plakātiem.',
      intro:
        'Piedāvājam dažādu drukas materiālu sagatavošanu un izgatavošanu reklāmai, prezentācijām un uzņēmuma ikdienas vajadzībām.',
      heroImage: 'images/web-design/reklamas-materialu-druka_small.webp',
      heroAlt: 'Bukleti un drukas materiāli',
      highlights: [
        { value: 'Bukleti', label: 'salokāmi un vienlapas risinājumi' },
        { value: 'Brošūras', label: 'vairāku lapu materiāliem' },
        { value: '18-30 EUR/h', label: 'dizaina un maketa darbiem' },
      ],
      offerings: [
        {
          title: 'Flajeri un bukleti',
          text: 'Akcijām, informācijai, izdalāmiem materiāliem un regulārām kampaņām.',
        },
        {
          title: 'Brošūras un katalogi',
          text: 'Plašākai informācijai par uzņēmumu, pakalpojumiem, cenām un piedāvājumiem.',
        },
        {
          title: 'Plakāti un citi materiāli',
          text: 'Risinājumi redzamākai komunikācijai tirdzniecības vietās, birojos un pasākumos.',
        },
      ],
      details: [
        'Palīdzam piemeklēt formātu, papīru un tirāžu atbilstoši lietojumam.',
        'Drukas materiālus varam apvienot vienā vizuālajā līnijā ar vizītkartēm, uzlīmēm un banneriem.',
        'Maketa sagatavošanas darbi orientējoši tiek rēķināti aptuveni 18-30 EUR stundā atkarībā no sarežģītības.',
      ],
      pricing: [
        { title: 'Cena pēc tirāžas un specifikācijas', text: 'Materiālu cenu nosaka formāts, papīrs, lapu skaits, krāsu skaits un pēcapstrāde.' },
      ],
      gallery: [
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/uiig_pages-to-jpg-0001-scaled.jpg',
        'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/skrejjjj.png',
      ],
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

  return content
}


export const siteContent = getSiteContent()

export const serviceBySlug = Object.fromEntries(
  siteContent.services.map((service) => [service.slug, service]),
)

export const serviceRouteEntries = siteContent.services.flatMap((service) => [
  { path: service.path, service, canonical: true },
  ...service.aliases.map((alias) => ({ path: alias, service, canonical: false })),
])


