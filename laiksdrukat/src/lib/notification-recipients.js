import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DEFAULT_EMAIL = 'matvejaleksejv@gmail.com'

function recipientsPath() {
  return join(process.cwd(), 'data', 'notification-recipients.json')
}

async function ensureRecipientsFile() {
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export async function getNotificationRecipients() {
  await ensureRecipientsFile()
  const raw = await readFile(recipientsPath(), 'utf8')
  const parsed = JSON.parse(raw)

  return parsed.filter((entry) => entry && entry.email)
}

export async function addNotificationRecipient(email) {
  const normalizedEmail = normalizeEmail(email)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Nepareizs e-pasta formāts.')
  }

  const recipients = await getNotificationRecipients()

  if (recipients.some((entry) => entry.email === normalizedEmail)) {
    return recipients
  }

  const updated = [
    ...recipients,
    {
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
    },
  ]

  await writeFile(recipientsPath(), JSON.stringify(updated, null, 2), 'utf8')
  return updated
}

export async function deleteNotificationRecipient(email) {
  const normalizedEmail = normalizeEmail(email)
  const recipients = await getNotificationRecipients()
  const updated = recipients.filter((entry) => entry.email !== normalizedEmail)

  await writeFile(recipientsPath(), JSON.stringify(updated, null, 2), 'utf8')
  return updated
}
