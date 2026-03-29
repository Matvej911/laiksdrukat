import { join } from 'node:path'
import xlsx from 'xlsx'

const OMNIVA_XLSX_PATH = join(process.cwd(), 'omnivapakomat.xlsx')

function normalizeValue(value) {
  return String(value || '').trim()
}

function buildLockerLabel(row) {
  const name = normalizeValue(row.Nosaukums)
  const city = normalizeValue(row.Pilseta)
  const street = normalizeValue(row.Iela)

  return [name, city, street].filter(Boolean).join(' — ')
}

function loadOmnivaLockers() {
  try {
    const workbook = xlsx.readFile(OMNIVA_XLSX_PATH)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })

    return rows
      .filter((row) => normalizeValue(row.Valsts) === 'LV')
      .map((row) => ({
        name: normalizeValue(row.Nosaukums),
        country: 'Latvija',
        countryCode: 'LV',
        district: normalizeValue(row.Novads),
        city: normalizeValue(row.Pilseta),
        street: normalizeValue(row.Iela),
        label: buildLockerLabel(row),
      }))
      .filter((locker) => locker.name && locker.city)
      .sort((a, b) => {
        const cityCompare = a.city.localeCompare(b.city, 'lv')
        if (cityCompare !== 0) return cityCompare
        return a.name.localeCompare(b.name, 'lv')
      })
  } catch (error) {
    return []
  }
}

const omnivaLockers = loadOmnivaLockers()

export function getOmnivaLockers() {
  return omnivaLockers
}

export function getOmnivaLockerGroups() {
  const groups = new Map()

  omnivaLockers.forEach((locker) => {
    if (!groups.has(locker.city)) {
      groups.set(locker.city, [])
    }

    groups.get(locker.city).push(locker)
  })

  return [...groups.entries()].map(([city, lockers]) => ({
    city,
    lockers,
  }))
}
