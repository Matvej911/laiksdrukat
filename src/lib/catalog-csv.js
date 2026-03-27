import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export const CATALOG_CSV_PATH = join(process.cwd(), 'export-products.csv')

const REQUIRED_HEADERS = [
  'ID',
  'Tips',
  'SKU',
  'GTIN, UPC, EAN, or ISBN',
  'Vārds',
  'Slug',
  'Publicēts',
  'Izcelts?',
  'Redzamība katalogā',
  'Īss apraksts',
  'Apraksts',
  'Akcijas cenas sākuma datums',
  'Akcijas cenas beigu datums',
  'Nodokļa status',
  'Nodokļu likme.',
  'Ir noliktavā?',
  'Noliktavā',
  'Zems krājumu apjoms',
  'Atļaut atpkaļpasūtījumus?',
  'Pārdot atsevišķi?',
  'Svars (kg)',
  'Garums (cm)',
  'Platums (cm)',
  'Augstums (cm)',
  'Atļaut klientu atsauksmes?',
  'Pirkuma piezīme',
  'Akcijas cena',
  'Parastā cena:',
  'Kategorija',
  'Birkas',
  'Piegādes klase',
  'Attēli',
  'Nospieduma paraugs',
  'Lejupielādes limits',
  'Lejupielādes derīguma termiņš',
  'Vecāks',
  'Grupētie produkti',
  'Pārdoti dārgāk',
  'Piepārdošanas',
  'Ārēja Saite',
  'Pogas teksts',
  'Pozīcija',
  'Swatches Attributes',
  'Zīmoli',
  'Atribūta 1 nosaukums',
  'Atribūta 1 vērtība (-s)',
  'Atribūta 1 redzamība',
  'Atribūta 1 ir globāls',
]

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1
      }

      row.push(field)
      if (row.some((value) => value !== '')) {
        rows.push(row)
      }
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((value) => value !== '')) {
      rows.push(row)
    }
  }

  return rows
}

function escapeCsv(value) {
  const stringValue = String(value ?? '')
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function stringifyCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(',')),
  ]

  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function ensureHeaders(headers) {
  const finalHeaders = [...headers]

  for (const header of REQUIRED_HEADERS) {
    if (!finalHeaders.includes(header)) {
      finalHeaders.push(header)
    }
  }

  return finalHeaders
}

function normalizePrice(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00'
}

export async function readCatalogCsv() {
  try {
    const text = await readFile(CATALOG_CSV_PATH, 'utf8')
    const rows = parseCsv(text)
    const originalHeaders = (rows.shift() || []).map((header) => header.replace(/^\uFEFF/, '').trim())
    const headers = ensureHeaders(originalHeaders)

    const items = rows.map((row) => {
      const entry = {}
      headers.forEach((header, index) => {
        entry[header] = row[index] ?? ''
      })
      return entry
    })

    return { headers, items }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { headers: [...REQUIRED_HEADERS], items: [] }
    }
    throw error
  }
}

export async function writeCatalogCsv(headers, items) {
  const finalHeaders = ensureHeaders(headers)
  await writeFile(CATALOG_CSV_PATH, stringifyCsv(finalHeaders, items), 'utf8')
}

export async function upsertProductInCatalogCsv(product, options = {}) {
  const { categoryName = '', previousSlug = '', previousName = '' } = options
  const { headers, items } = await readCatalogCsv()

  const matchIndex = items.findIndex((row) => (
    row.Slug === product.slug
    || (previousSlug && row.Slug === previousSlug)
    || row['Vārds'] === product.name
    || (previousName && row['Vārds'] === previousName)
  ))

  const row = matchIndex >= 0
    ? { ...items[matchIndex] }
    : Object.fromEntries(headers.map((header) => [header, '']))

  row.Tips = row.Tips || 'simple'
  row['Vārds'] = product.name
  row.Slug = product.slug
  row['Publicēts'] = product.active ? '1' : '0'
  row['Izcelts?'] = product.featured ? '1' : '0'
  row['Redzamība katalogā'] = product.active ? 'visible' : 'hidden'
  row['Īss apraksts'] = product.description || ''
  row['Apraksts'] = product.description || ''
  row['Parastā cena:'] = normalizePrice(product.price)
  row['Akcijas cena'] = row['Akcijas cena'] || ''
  row.Kategorija = categoryName || row.Kategorija || 'Citi'
  row['Attēli'] = product.image || ''
  row['Nospieduma paraugs'] = product.imprintImage || ''
  row['Ir noliktavā?'] = Number(product.stock) > 0 ? '1' : '0'
  row['Noliktavā'] = String(Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0)

  if (matchIndex >= 0) {
    items[matchIndex] = row
  } else {
    items.push(row)
  }

  await writeCatalogCsv(headers, items)
}

export async function removeProductFromCatalogCsv({ slug, name }) {
  const { headers, items } = await readCatalogCsv()
  const filtered = items.filter((row) => row.Slug !== slug && row['Vārds'] !== name)
  await writeCatalogCsv(headers, filtered)
}
