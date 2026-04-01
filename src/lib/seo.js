export function resolvePublicBaseUrl() {
  return String(process.env.APP_URL || 'https://www.laiksdrukat.lv').replace(/\/+$/, '')
}

export function toAbsoluteUrl(baseUrl, value) {
  if (!value) return null
  return value.startsWith('http')
    ? value
    : new URL(value.startsWith('/') ? value : `/${value}`, `${baseUrl}/`).toString()
}

export function buildBreadcrumbSchema(baseUrl, items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
      .filter((item) => item && item.name)
      .map((item, index) => {
        const listItem = {
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
        }

        if (item.path) {
          listItem.item = toAbsoluteUrl(baseUrl, item.path)
        }

        return listItem
      }),
  }
}

export function appendStructuredData(existing, addition) {
  if (!existing) return addition
  if (Array.isArray(existing)) return [...existing, addition]
  return [existing, addition]
}
