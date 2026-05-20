import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const CONTACT_MESSAGES_TABLE = 'ContactSubmission'
const CONTACT_MESSAGES_TABLE_SQL = Prisma.raw(`\`${CONTACT_MESSAGES_TABLE}\``)
const CONTACT_MESSAGES_CREATED_AT_INDEX_SQL = Prisma.raw(`\`${CONTACT_MESSAGES_TABLE}_createdAt_idx\``)
let contactMessagesTableReady = false
let contactMessagesTableUnavailable = false

function getContactMessagesFilepath() {
  return join(process.cwd(), 'data', 'contact-submissions', 'messages.jsonl')
}

function normalizeEntry(entry) {
  if (!entry) return null

  const attachment = entry.attachment
    ? {
        name: entry.attachment.name || null,
        url: entry.attachment.url || null,
        path: entry.attachment.path || null,
      }
    : null

  return {
    id: entry.id,
    createdAt: entry.createdAt,
    name: entry.name,
    email: entry.email,
    phone: entry.phone || null,
    message: entry.message,
    source: entry.source || null,
    attachment: attachment && (attachment.name || attachment.url || attachment.path) ? attachment : null,
  }
}

function toMysqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now())

  if (Number.isNaN(date.getTime())) {
    return toMysqlDateTime(new Date())
  }

  return date.toISOString().replace('T', ' ').replace('Z', '')
}

async function readFileMessages() {
  try {
    const file = await readFile(getContactMessagesFilepath(), 'utf8')

    return file
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => normalizeEntry(JSON.parse(line)))
      .filter(Boolean)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function appendFileMessage(entry) {
  const submissionsDir = join(process.cwd(), 'data', 'contact-submissions')
  await mkdir(submissionsDir, { recursive: true })
  await appendFile(getContactMessagesFilepath(), `${JSON.stringify(entry)}\n`, 'utf8')
}

async function writeFileMessages(entries) {
  const submissionsDir = join(process.cwd(), 'data', 'contact-submissions')
  await mkdir(submissionsDir, { recursive: true })

  const serialized = entries
    .map((entry) => `${JSON.stringify(entry)}\n`)
    .join('')

  await writeFile(getContactMessagesFilepath(), serialized, 'utf8')
}

async function ensureContactMessagesTable(db) {
  if (contactMessagesTableReady) return true
  if (contactMessagesTableUnavailable) return false

  try {
    const result = await db.$queryRaw`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ${CONTACT_MESSAGES_TABLE}
      LIMIT 1
    `

    if (Array.isArray(result) && result.length > 0) {
      contactMessagesTableReady = true
      return true
    }

    await db.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS ${CONTACT_MESSAGES_TABLE_SQL} (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`email\` VARCHAR(191) NOT NULL,
        \`phone\` VARCHAR(191) NULL,
        \`message\` TEXT NOT NULL,
        \`source\` VARCHAR(191) NULL,
        \`attachmentName\` VARCHAR(191) NULL,
        \`attachmentUrl\` VARCHAR(191) NULL,
        \`attachmentPath\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX ${CONTACT_MESSAGES_CREATED_AT_INDEX_SQL} (\`createdAt\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `)

    contactMessagesTableReady = true
    return true
  } catch {
    contactMessagesTableUnavailable = true
    return false
  }
}

async function readDatabaseMessages(db) {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT
      id,
      name,
      email,
      phone,
      message,
      source,
      attachmentName,
      attachmentUrl,
      attachmentPath,
      createdAt
    FROM ${CONTACT_MESSAGES_TABLE_SQL}
    ORDER BY createdAt DESC
  `)

  return Array.isArray(rows)
    ? rows.map((row) => normalizeEntry({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        source: row.source,
        createdAt: row.createdAt,
        attachment: row.attachmentName || row.attachmentUrl || row.attachmentPath
          ? {
              name: row.attachmentName,
              url: row.attachmentUrl,
              path: row.attachmentPath,
            }
          : null,
      }))
    : []
}

async function readDatabaseMessageById(id, db) {
  const rows = await db.$queryRaw(
    Prisma.sql`
      SELECT
        id,
        name,
        email,
        phone,
        message,
        source,
        attachmentName,
        attachmentUrl,
        attachmentPath,
        createdAt
      FROM ${CONTACT_MESSAGES_TABLE_SQL}
      WHERE id = ${id}
      LIMIT 1
    `,
  )

  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  const row = rows[0]

  return normalizeEntry({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    source: row.source,
    createdAt: row.createdAt,
    attachment: row.attachmentName || row.attachmentUrl || row.attachmentPath
      ? {
          name: row.attachmentName,
          url: row.attachmentUrl,
          path: row.attachmentPath,
        }
      : null,
  })
}

async function writeDatabaseMessage(entry, db) {
  await db.$executeRaw(
    Prisma.sql`
      INSERT INTO ${CONTACT_MESSAGES_TABLE_SQL}
        (id, name, email, phone, message, source, attachmentName, attachmentUrl, attachmentPath, createdAt)
      VALUES (
        ${entry.id},
        ${entry.name},
        ${entry.email},
        ${entry.phone},
        ${entry.message},
        ${entry.source},
        ${entry.attachment?.name || null},
        ${entry.attachment?.url || null},
        ${entry.attachment?.path || null},
        ${toMysqlDateTime(entry.createdAt)}
      )
    `,
  )
}

export async function listContactMessages(db) {
  const fileMessages = await readFileMessages()

  if (!db || !(await ensureContactMessagesTable(db))) {
    return fileMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  const dbMessages = await readDatabaseMessages(db)
  const merged = new Map()

  for (const message of [...dbMessages, ...fileMessages]) {
    if (!message?.id || merged.has(message.id)) continue
    merged.set(message.id, message)
  }

  return [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function saveContactMessage(entry, db) {
  const normalized = normalizeEntry(entry)

  if (db && await ensureContactMessagesTable(db)) {
    await writeDatabaseMessage(normalized, db)
    return { storage: 'database' }
  }

  await appendFileMessage(normalized)
  return { storage: 'file' }
}

export async function deleteContactMessage(id, db) {
  const messageId = String(id || '').trim()
  if (!messageId) return null

  const fileMessages = await readFileMessages()
  const remainingFileMessages = fileMessages.filter((entry) => entry.id !== messageId)
  const deletedFileMessage = fileMessages.find((entry) => entry.id === messageId) || null

  if (remainingFileMessages.length !== fileMessages.length) {
    await writeFileMessages(remainingFileMessages)
  }

  let deletedDbMessage = null

  if (db && await ensureContactMessagesTable(db)) {
    deletedDbMessage = await readDatabaseMessageById(messageId, db)
    await db.$executeRaw(
      Prisma.sql`DELETE FROM ${CONTACT_MESSAGES_TABLE_SQL} WHERE id = ${messageId}`,
    )
  }

  return deletedDbMessage || deletedFileMessage || null
}
