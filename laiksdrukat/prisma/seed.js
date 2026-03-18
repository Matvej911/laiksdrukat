import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { access, readFile } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const CSV_PATH = join(process.cwd(), 'export-products.csv')

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

function toObjects(text) {
  const rows = parseCsv(text)
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim())

  return rows.map((row) => {
    const entry = {}
    headers.forEach((header, index) => {
      entry[header] = row[index] ?? ''
    })
    return entry
  })
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' un ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCategoryName(value) {
  const first = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0]

  return first || 'Citi'
}

function normalizePrice(value) {
  const numeric = Number(String(value || '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeStock(row) {
  if (String(row['Ir noliktavā?'] || '') !== '1') {
    return 0
  }

  const stock = Number(String(row['Noliktavā'] || '').replace(',', '.'))
  if (!Number.isFinite(stock) || stock <= 0) {
    return 1
  }

  return Math.round(stock)
}

function normalizeDescription(value) {
  const text = String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .trim()

  return text || null
}

function extractImage(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0] || null
}

function buildProductSlug(name, categorySlug) {
  let slug = slugify(name)

  if (categorySlug === 'zimogi' && slug.startsWith('printer-')) {
    slug = `colop-${slug.replace(/^printer-/, '')}`
  } else if (categorySlug === 'zimogi' && !slug.startsWith('colop-')) {
    slug = `colop-${slug}`
  }

  return slug
}

async function seedFromCsv() {
  await access(CSV_PATH, constants.F_OK)
  const rows = toObjects(await readFile(CSV_PATH, 'utf8'))
  const categoryCache = new Map()
  let imported = 0

  for (const row of rows) {
    if (String(row['Publicēts'] || '') !== '1') continue
    if (row['Tips'] && row['Tips'] !== 'simple') continue

    const name = String(row['Vārds'] || '').trim()
    if (!name) continue

    const categoryName = normalizeCategoryName(row['Kategorija'])
    const categorySlug = slugify(categoryName)

    let categoryId = categoryCache.get(categorySlug)
    if (!categoryId) {
      const category = await prisma.category.upsert({
        where: { slug: categorySlug },
        update: { name: categoryName },
        create: { name: categoryName, slug: categorySlug },
      })
      categoryId = category.id
      categoryCache.set(categorySlug, category.id)
    }

    const product = {
      name,
      slug: buildProductSlug(name, categorySlug),
      description: normalizeDescription(row['Apraksts'] || row['Īss apraksts']),
      price: normalizePrice(row['Parastā cena:'] || row['Akcijas cena']),
      image: extractImage(row['Attēli']),
      stock: normalizeStock(row),
      active: true,
      categoryId,
    }

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    })

    imported += 1
  }

  console.log(`✅ Imported ${imported} products from export-products.csv`)
}

async function main() {
  await seedFromCsv()

  const hash = await bcrypt.hash('admin123', 10)
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: hash },
  })

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
