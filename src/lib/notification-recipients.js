import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DEFAULT_EMAIL = 'matvejaleksejv@gmail.com'

function recipientsPath() {
  return join(process.cwd(), 'data', 'notification-recipients.json')
}

async function ensureLegacyRecipientsFile() {
  const filepath = recipientsPath()

  try {
    await readFile(filepath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }

    await mkdir(join(process.cwd(), 'data'), { recursive: true })
    await writeFile(
      filepath,
      JSON.stringify(
        [
          {
            email: DEFAULT_EMAIL,
            createdAt: new Date().toISOString(),
          },
        ],
        null,
        2,
      ),
      'utf8',
    )
  }
}

async function readLegacyRecipients() {
  await ensureLegacyRecipientsFile()
  const raw = await readFile(recipientsPath(), 'utf8')
  const parsed = JSON.parse(raw)

  return Array.isArray(parsed)
    ? parsed.filter((entry) => entry && entry.email)
    : []
}

async function writeLegacyRecipients(recipients) {
  await mkdir(join(process.cwd(), 'data'), { recursive: true })
  await writeFile(recipientsPath(), JSON.stringify(recipients, null, 2), 'utf8')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function hasNotificationRecipientTable(db) {
  try {
    const rows = await db.$queryRaw`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ${'NotificationRecipient'}
    `

    const count = Array.isArray(rows) && rows[0]
      ? Number(rows[0].count ?? Object.values(rows[0])[0] ?? 0)
      : 0

    return count > 0
  } catch (error) {
    return false
  }
}

async function seedRecipientsToDb(db) {
  const existing = await db.notificationRecipient.findMany({
    select: { email: true },
  })

  if (existing.length > 0) {
    return
  }

  const legacyRecipients = await readLegacyRecipients()
  const recipientsToSeed = legacyRecipients.length > 0
    ? legacyRecipients
    : [{ email: DEFAULT_EMAIL, createdAt: new Date().toISOString() }]

  for (const entry of recipientsToSeed) {
    const email = normalizeEmail(entry.email)
    if (!email) continue

    await db.notificationRecipient.upsert({
      where: { email },
      update: {},
      create: {
        email,
        createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
      },
    })
  }
}

async function syncRecipientsToLegacyFile(recipients) {
  const normalized = recipients
    .map((entry) => ({
      email: normalizeEmail(entry.email),
      createdAt: entry.createdAt
        ? new Date(entry.createdAt).toISOString()
        : new Date().toISOString(),
    }))
    .filter((entry) => entry.email)

  await writeLegacyRecipients(normalized)
}

export async function getNotificationRecipients(db) {
  if (db && await hasNotificationRecipientTable(db)) {
    await seedRecipientsToDb(db)
    const recipients = await db.notificationRecipient.findMany({
      orderBy: { createdAt: 'asc' },
    })
    await syncRecipientsToLegacyFile(recipients)
    return recipients
  }

  return readLegacyRecipients()
}

export async function addNotificationRecipient(email, db) {
  const normalizedEmail = normalizeEmail(email)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Nepareizs e-pasta formāts.')
  }

  if (db && await hasNotificationRecipientTable(db)) {
    await seedRecipientsToDb(db)

    await db.notificationRecipient.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail },
    })

    const recipients = await db.notificationRecipient.findMany({
      orderBy: { createdAt: 'asc' },
    })
    await syncRecipientsToLegacyFile(recipients)
    return recipients
  }

  const recipients = await readLegacyRecipients()

  if (recipients.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
    return recipients
  }

  const updated = [
    ...recipients,
    {
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
    },
  ]

  await writeLegacyRecipients(updated)
  return updated
}

export async function deleteNotificationRecipient(email, db) {
  const normalizedEmail = normalizeEmail(email)

  if (db && await hasNotificationRecipientTable(db)) {
    await seedRecipientsToDb(db)
    await db.notificationRecipient.deleteMany({
      where: { email: normalizedEmail },
    })
    const recipients = await db.notificationRecipient.findMany({
      orderBy: { createdAt: 'asc' },
    })
    await syncRecipientsToLegacyFile(recipients)
    return recipients
  }

  const recipients = await readLegacyRecipients()
  const updated = recipients.filter((entry) => normalizeEmail(entry.email) !== normalizedEmail)

  await writeLegacyRecipients(updated)
  return updated
}
