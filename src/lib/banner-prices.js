import { Prisma } from '@prisma/client'

const SETTINGS_TABLE = 'SiteSetting'
const SETTINGS_TABLE_SQL = Prisma.raw(`\`${SETTINGS_TABLE}\``)
const SETTINGS_KEY = 'banner_prices'
let settingsTableReady = false
let settingsTableUnavailable = false

export const DEFAULT_BANNER_PRICES = {
  pvc: [
    { id: 'pvc_1_2', area: '1-2', price: '26,00' },
    { id: 'pvc_3_4', area: '3-4', price: '13,00' },
    { id: 'pvc_5_10', area: '5-10', price: '12,00' },
    { id: 'pvc_11_50', area: '11-50', price: '10,00' },
    { id: 'pvc_50_plus', area: '50+', price: '8,50' },
  ],
  rollup: [
    { id: 'rollup_with_85', type: 'Ar mehanismu', size: '85 x 200', price: '68,00' },
    { id: 'rollup_with_100', type: 'Ar mehanismu', size: '100 x 200', price: '73,00' },
    { id: 'rollup_with_120', type: 'Ar mehanismu', size: '120 x 200', price: '98,00' },
    { id: 'rollup_with_150', type: 'Ar mehanismu', size: '150 x 200', price: '118,00' },
    { id: 'rollup_without_85', type: 'Bez mehanisma', size: '85 x 200', price: '32,00' },
    { id: 'rollup_without_100', type: 'Bez mehanisma', size: '100 x 200', price: '35,00' },
    { id: 'rollup_without_120', type: 'Bez mehanisma', size: '120 x 200', price: '62,00' },
    { id: 'rollup_without_150', type: 'Bez mehanisma', size: '150 x 200', price: '68,00' },
  ],
}

function cloneDefaultPrices() {
  return {
    pvc: DEFAULT_BANNER_PRICES.pvc.map((row) => ({ ...row })),
    rollup: DEFAULT_BANNER_PRICES.rollup.map((row) => ({ ...row })),
  }
}

function displayLabel(value) {
  return String(value || '')
    .replace(/-/g, '–')
    .replace(/ x /g, ' × ')
    .replace(/mehanismu/g, 'mehānismu')
    .replace(/mehanisma/g, 'mehānisma')
}

export function formatBannerPrice(value, fallback = '0,00') {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed.toFixed(2).replace('.', ',')
}

export function normalizeBannerPrices(input = {}) {
  const savedById = new Map([
    ...Array.isArray(input.pvc) ? input.pvc : [],
    ...Array.isArray(input.rollup) ? input.rollup : [],
  ].map((row) => [row?.id, row]))

  return {
    pvc: DEFAULT_BANNER_PRICES.pvc.map((row) => ({
      ...row,
      areaLabel: displayLabel(row.area),
      price: formatBannerPrice(savedById.get(row.id)?.price, row.price),
    })),
    rollup: DEFAULT_BANNER_PRICES.rollup.map((row) => ({
      ...row,
      typeLabel: displayLabel(row.type),
      sizeLabel: displayLabel(row.size),
      price: formatBannerPrice(savedById.get(row.id)?.price, row.price),
    })),
  }
}

export function normalizeBannerPricesFromForm(fields = {}) {
  return normalizeBannerPrices({
    pvc: DEFAULT_BANNER_PRICES.pvc.map((row) => ({
      id: row.id,
      price: fields[`${row.id}_price`],
    })),
    rollup: DEFAULT_BANNER_PRICES.rollup.map((row) => ({
      id: row.id,
      price: fields[`${row.id}_price`],
    })),
  })
}

async function ensureSettingsTable(db) {
  if (settingsTableReady) return true
  if (settingsTableUnavailable) return false

  try {
    const result = await db.$queryRaw`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ${SETTINGS_TABLE}
      LIMIT 1
    `

    if (Array.isArray(result) && result.length > 0) {
      settingsTableReady = true
      return true
    }

    await db.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE_SQL} (
        \`settingKey\` VARCHAR(191) NOT NULL,
        \`value\` LONGTEXT NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`settingKey\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `)

    settingsTableReady = true
    return true
  } catch {
    settingsTableUnavailable = true
    return false
  }
}

export async function getBannerPrices(db) {
  if (!db || !await ensureSettingsTable(db)) {
    return normalizeBannerPrices(cloneDefaultPrices())
  }

  try {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT \`value\`
      FROM ${SETTINGS_TABLE_SQL}
      WHERE \`settingKey\` = ${SETTINGS_KEY}
      LIMIT 1
    `)
    const stored = Array.isArray(rows) && rows[0]?.value
      ? JSON.parse(rows[0].value)
      : cloneDefaultPrices()

    return normalizeBannerPrices(stored)
  } catch {
    return normalizeBannerPrices(cloneDefaultPrices())
  }
}

export async function saveBannerPrices(fields, db) {
  const prices = normalizeBannerPricesFromForm(fields)
  const serialized = JSON.stringify(prices)

  if (!db || !await ensureSettingsTable(db)) {
    throw new Error('Neizdevās saglabāt banneru cenas datubāzē.')
  }

  await db.$executeRaw(Prisma.sql`
    INSERT INTO ${SETTINGS_TABLE_SQL} (\`settingKey\`, \`value\`)
    VALUES (${SETTINGS_KEY}, ${serialized})
    ON DUPLICATE KEY UPDATE
      \`value\` = ${serialized},
      \`updatedAt\` = CURRENT_TIMESTAMP(3)
  `)

  return prices
}
