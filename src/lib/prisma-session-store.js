const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toDate(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function computeExpiry(session, sessionTtlMs) {
  const cookieExpiry = toDate(session?.cookie?.expires)
  if (cookieExpiry) {
    return cookieExpiry
  }

  return new Date(Date.now() + sessionTtlMs)
}

function serializeSession(session) {
  return JSON.stringify(session)
}

function deserializeSession(serialized) {
  return JSON.parse(serialized)
}

export class PrismaSessionStore {
  constructor(prisma, options = {}) {
    this.prisma = prisma
    this.sessionTtlMs = parsePositiveInt(options.sessionTtlMs, DEFAULT_SESSION_TTL_MS)
    this.cleanupIntervalMs = parsePositiveInt(options.cleanupIntervalMs, DEFAULT_CLEANUP_INTERVAL_MS)
    this.lastCleanupAt = 0
    this.cleanupPromise = null
  }

  maybeCleanupExpiredSessions() {
    const now = Date.now()
    if (this.cleanupPromise || now - this.lastCleanupAt < this.cleanupIntervalMs) {
      return
    }

    this.lastCleanupAt = now
    this.cleanupPromise = this.prisma.sessionRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(now),
        },
      },
    })
      .catch(() => {})
      .finally(() => {
        this.cleanupPromise = null
      })
  }

  set(sessionId, session, callback) {
    const expiresAt = computeExpiry(session, this.sessionTtlMs)
    const data = serializeSession(session)

    this.prisma.sessionRecord.upsert({
      where: { id: sessionId },
      update: { data, expiresAt },
      create: { id: sessionId, data, expiresAt },
    })
      .then(() => {
        this.maybeCleanupExpiredSessions()
        callback()
      })
      .catch((error) => {
        callback(error)
      })
  }

  get(sessionId, callback) {
    this.prisma.sessionRecord.findUnique({
      where: { id: sessionId },
    })
      .then((record) => {
        this.maybeCleanupExpiredSessions()

        if (!record) {
          callback(null, null)
          return
        }

        if (record.expiresAt.getTime() <= Date.now()) {
          return this.prisma.sessionRecord.delete({
            where: { id: sessionId },
          })
            .catch(() => {})
            .then(() => {
              callback(null, null)
            })
        }

        callback(null, deserializeSession(record.data))
      })
      .catch((error) => {
        callback(error)
      })
  }

  destroy(sessionId, callback) {
    this.prisma.sessionRecord.deleteMany({
      where: { id: sessionId },
    })
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error)
      })
  }
}

export function getSessionStoreOptionsFromEnv() {
  return {
    sessionTtlMs: parsePositiveInt(process.env.SESSION_STORE_TTL_MS, DEFAULT_SESSION_TTL_MS),
    cleanupIntervalMs: parsePositiveInt(process.env.SESSION_STORE_CLEANUP_INTERVAL_MS, DEFAULT_CLEANUP_INTERVAL_MS),
  }
}
