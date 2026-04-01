import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const OMNIVA_JSON_PATH = join(process.cwd(), 'omnivapakomat.json')

function normalizeValue(value) {
  return String(value || '').trim()
}

function buildLockerLabel(row) {
  const name = normalizeValue(row.Nosaukums)
  const city = normalizeValue(row.Pilseta)
  const street = normalizeValue(row.Iela)

  return [name, city, street].filter(Boolean).join(' — ')
}

function readOmnivaRows() {
  const raw = readFileSync(OMNIVA_JSON_PATH, 'utf8')
  const parsed = JSON.parse(raw)

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (Array.isArray(parsed.omnivapakomat)) {
    return parsed.omnivapakomat
  }

  if (Array.isArray(parsed.ominapakomat)) {
    return parsed.ominapakomat
  }

  return []
}

function loadOmnivaLockers() {
  try {
    const rows = readOmnivaRows()

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
