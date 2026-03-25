import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'

export function sanitizeFilename(filename) {
  return String(filename || '').replace(/[^a-zA-Z0-9._-]/g, '-')
}

export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return null

  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'

  const start = buffer.slice(0, 128).toString('utf8').trimStart()
  if (start.startsWith('<svg') || start.startsWith('<?xml') || start.startsWith('<!DOCTYPE svg')) {
    return 'image/svg+xml'
  }

  return null
}

export function validateDocumentOrImageUpload(buffer, ext) {
  if (!buffer || buffer.length < 4) return false

  const normalizedExt = String(ext || '').toLowerCase()
  const imageMime = detectImageMime(buffer)
  if (imageMime) {
    return new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']).has(normalizedExt)
  }

  switch (normalizedExt) {
    case '.pdf':
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
    case '.doc':
      return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0
    case '.docx':
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04
    case '.eps':
    case '.ai': {
      const start = buffer.slice(0, 32).toString('utf8')
      return start.startsWith('%!PS') || start.startsWith('%PDF')
    }
    default:
      return false
  }
}

export function validateImageUpload(buffer, ext) {
  const normalizedExt = String(ext || '').toLowerCase()
  if (!new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']).has(normalizedExt)) {
    return false
  }

  return Boolean(detectImageMime(buffer))
}

export function contentTypeFromFilename(filename) {
  switch (extname(String(filename || '')).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.ai':
    case '.eps':
      return 'application/postscript'
    default:
      return 'application/octet-stream'
  }
}

export function getUploadsRootDir() {
  const configured = String(process.env.UPLOADS_DIR || '').trim()
  if (!configured) {
    return join(process.cwd(), 'data', 'uploads')
  }

  if (/^[A-Za-z]:[\\/]/.test(configured) || configured.startsWith('/')) {
    return configured
  }

  return join(process.cwd(), configured)
}

export async function persistUpload({ subdir, originalName, buffer, urlPrefix }) {
  const ext = extname(String(originalName || '')).toLowerCase() || '.bin'
  const safeName = sanitizeFilename(originalName)
  const filename = `${Date.now()}-${randomUUID()}-${safeName}${safeName.endsWith(ext) ? '' : ext}`
  const baseDir = join(getUploadsRootDir(), subdir)
  const filepath = join(baseDir, filename)
  const relativePath = join(subdir, filename)

  await mkdir(baseDir, { recursive: true })
  await writeFile(filepath, buffer)

  return {
    filename,
    filepath,
    relativePath,
    subdir,
    size: buffer.length,
    url: `${urlPrefix}/${filename}`,
  }
}

export function resolveUploadPath(relativePath) {
  return join(getUploadsRootDir(), relativePath)
}

export async function sendStoredFile(reply, filepath, filename) {
  const buffer = await readFile(filepath)
  reply.type(contentTypeFromFilename(filename))
  return reply.send(buffer)
}
