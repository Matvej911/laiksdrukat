import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const CSRF = require('@fastify/csrf')

const tokens = new CSRF()

export function hasValidSessionCsrf(request, token) {
  const secret = request.session?._csrf
  if (!secret || !token) {
    return false
  }

  return tokens.verify(secret, String(token))
}
