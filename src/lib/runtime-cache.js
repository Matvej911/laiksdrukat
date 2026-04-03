const store = new Map()

function getCacheEntry(key) {
  const entry = store.get(key)
  if (!entry) {
    return { hit: false, value: null }
  }

  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return { hit: false, value: null }
  }

  return { hit: true, value: entry.value }
}

export async function getOrSetCache(key, ttlMs, factory) {
  const cached = getCacheEntry(key)
  if (cached.hit) {
    return { hit: true, value: cached.value }
  }

  const value = await factory()
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })

  return { hit: false, value }
}

export function clearCache(key) {
  if (typeof key === 'undefined') {
    store.clear()
    return
  }

  store.delete(key)
}
