const DEFAULT_MAX_CACHE_ENTRIES = 250
const configuredMaxEntries = Number.parseInt(process.env.RUNTIME_CACHE_MAX_ENTRIES || '', 10)
const MAX_CACHE_ENTRIES = Number.isFinite(configuredMaxEntries) && configuredMaxEntries > 0
  ? configuredMaxEntries
  : DEFAULT_MAX_CACHE_ENTRIES

const store = new Map()

function deleteExpiredEntries(now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt > now) {
      continue
    }

    store.delete(key)
  }
}

function touchEntry(key, entry) {
  store.delete(key)
  store.set(key, entry)
}

function enforceCacheLimit() {
  if (store.size <= MAX_CACHE_ENTRIES) {
    return
  }

  const overflow = store.size - MAX_CACHE_ENTRIES
  const oldestKeys = store.keys()

  for (let index = 0; index < overflow; index += 1) {
    const next = oldestKeys.next()
    if (next.done) {
      break
    }

    store.delete(next.value)
  }
}

function getCacheEntry(key) {
  const entry = store.get(key)
  if (!entry) {
    return { hit: false, value: null }
  }

  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return { hit: false, value: null }
  }

  // Refresh recency so frequently used entries are evicted last.
  touchEntry(key, entry)
  return { hit: true, value: entry.value }
}

export async function getOrSetCache(key, ttlMs, factory) {
  deleteExpiredEntries()
  const cached = getCacheEntry(key)
  if (cached.hit) {
    return { hit: true, value: cached.value }
  }

  const value = await factory()
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
  enforceCacheLimit()

  return { hit: false, value }
}

export function clearCache(key) {
  if (typeof key === 'undefined') {
    store.clear()
    return
  }

  store.delete(key)
}
