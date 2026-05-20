import nodemailer from 'nodemailer'
import { Eta } from 'eta'
import { readFile } from 'fs/promises'

const viewsPath = path.join(process.cwd(), 'src/views')
import { getNotificationRecipients } from './notification-recipients.js'
import { getStoredOrderTotals } from './shipping.js'
import path from 'path'
const eta = new Eta({ views: viewsPath })
let cachedTransporter = null
let cachedTransporterKey = null

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtmlWithLineBreaks(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function getAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim()

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '')
  }

  const host = process.env.HOST && process.env.HOST !== '0.0.0.0'
    ? process.env.HOST
    : 'localhost'
  const port = process.env.PORT || '3000'

  return `http://${host}:${port}`
}

function toAbsoluteUrl(value) {
  if (!value) return value
  if (/^https?:\/\//i.test(value)) return value

  try {
    return new URL(value, `${getAppUrl()}/`).toString()
  } catch {
    return value
  }
}

function getMailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const resendFrom = process.env.RESEND_FROM?.trim()
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || ''
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  return {
    resendApiKey,
    resendFrom,
    resendReplyTo: process.env.RESEND_REPLY_TO?.trim() || user || null,
    resendConfigured: Boolean(resendApiKey && resendFrom),
    host,
    port,
    user,
    pass,
    from,
    secure,
    configured: Boolean(host && port && user && pass && from),
  }
}

export function isMailConfigured() {
  const config = getMailConfig()
  return config.resendConfigured || config.configured
}

async function createTransporter() {
  const config = getMailConfig()

  if (!config.configured) {
    cachedTransporter = null
    cachedTransporterKey = null
    return null
  }

  const cacheKey = JSON.stringify({
    host: config.host,
    port: config.port,
    user: config.user,
    secure: config.secure,
    from: config.from,
  })

  if (cachedTransporter && cachedTransporterKey === cacheKey) {
    return cachedTransporter
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 10 * 1000,
    greetingTimeout: 10 * 1000,
    socketTimeout: 15 * 1000,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  cachedTransporterKey = cacheKey
  return cachedTransporter
}

async function normalizeResendAttachment(attachment) {
  if (!attachment) return null

  if (attachment.content && attachment.filename) {
    return {
      filename: attachment.filename,
      content: attachment.content,
    }
  }

  if (attachment.path && attachment.filename) {
    const content = await readFile(attachment.path)
    return {
      filename: attachment.filename,
      content: content.toString('base64'),
    }
  }

  if (attachment.path) {
    return {
      path: attachment.path,
      filename: attachment.filename || 'attachment',
    }
  }

  return null
}

async function sendViaResend({ config, to, subject, text, html, attachments = [], replyTo = null }) {
  const normalizedAttachments = (
    await Promise.all(attachments.map(normalizeResendAttachment))
  ).filter(Boolean)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.resendFrom,
      to,
      subject,
      text,
      html,
      reply_to: replyTo || config.resendReplyTo || undefined,
      attachments: normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
    }),
  })

  if (!response.ok) {
    let detail = ''

    try {
      const data = await response.json()
      detail = data?.message || data?.error || JSON.stringify(data)
    } catch {
      detail = await response.text()
    }

    throw new Error(`Resend request failed (${response.status}): ${detail}`)
  }

  return { sent: true }
}

async function sendViaSmtp({ config, to, subject, text, html, attachments = [], replyTo = null }) {
  const transporter = await createTransporter()

  if (!transporter) {
    return { sent: false, reason: 'mail-not-configured' }
  }

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
    attachments,
    replyTo: replyTo || undefined,
  })

  return { sent: true }
}

async function sendMail({ to, subject, text, html, attachments = [] }) {
  const config = getMailConfig()

  if (config.resendConfigured) {
    return sendViaResend({
      config,
      to,
      subject,
      text,
      html,
      attachments,
    })
  }

  return sendViaSmtp({
    config,
    to,
    subject,
    text,
    html,
    attachments,
  })
}

async function sendOwnerNotificationMail({ subject, text, html, attachments = [], db = null }) {
  const recipients = await getNotificationRecipients(db)

  if (recipients.length === 0) {
    return { sent: false, reason: 'no-recipients', recipients }
  }

  const result = await sendMail({
    to: recipients.map((entry) => entry.email),
    subject,
    text,
    html,
    attachments,
  })

  return {
    ...result,
    recipients,
  }
}

function formatOrderOptions(options = {}) {
  return Object.entries(options)
    .filter(([key]) => key !== 'Faila saite' && !key.startsWith('__'))
    .map(([key, value]) => {
      const optionValue = key === 'Faila saite' ? toAbsoluteUrl(value) : value
      return `- ${key}: ${optionValue}`
    })
    .join('\n')
}

export async function sendContactNotification(submission) {
  const subject = `Jauna kontaktforma: ${submission.name}`
  const text = [
    'Saņemta jauna kontaktformas ziņa.',
    '',
    `Vārds: ${submission.name}`,
    `E-pasts: ${submission.email}`,
    `Tālrunis: ${submission.phone || '-'}`,
    '',
    'Ziņa:',
    submission.message,
    '',
    submission.attachment
      ? `Pielikums: ${submission.attachment.name}`
      : 'Pielikums: nav',
  ].join('\n')

  const html = `
    <h2>Saņemta jauna kontaktformas ziņa</h2>
    <p><strong>Vārds:</strong> ${escapeHtml(submission.name)}</p>
    <p><strong>E-pasts:</strong> ${escapeHtml(submission.email)}</p>
    <p><strong>Tālrunis:</strong> ${escapeHtml(submission.phone || '-')}</p>
    <p><strong>Ziņa:</strong></p>
    <p>${escapeHtmlWithLineBreaks(submission.message)}</p>
    <p><strong>Pielikums:</strong> ${escapeHtml(submission.attachment ? submission.attachment.name : 'nav')}</p>
  `

  return sendOwnerNotificationMail({
    subject,
    text,
    html,
    attachments: submission.attachment
      ? [{ filename: submission.attachment.name, path: submission.attachment.path }]
      : [],
    db: submission.db || null,
  })
}

function getOrderSummaries({ order, cart }) {
  const { subtotal, shipping, totalVat, totalWithVat } = getStoredOrderTotals(order)
  const lines = cart.map((item) => {
    const options = formatOrderOptions(item.options)

    let fileLine = ''

    if (item.options?.['Faila saite']) {
      fileLine = `Fails: ${toAbsoluteUrl(item.options['Faila saite'])}`
    }

    return [
      `${item.name} x ${item.quantity}`,
      `Cena bez PVN: ${(Number(item.price) * item.quantity * 1.21).toFixed(2)} EUR`,
      options,
      fileLine,
    ]
      .filter(Boolean)
      .join('\n')
  })

  const htmlItems = cart
    .map((item) => {
      const options = Object.entries(item.options || {})
        .map(([key, value]) => {

          // ✅ FILE LINK (button)
      if (key === 'Faila saite') {
        const fileUrl = toAbsoluteUrl(value)
        return `
              <div style="margin-top:8px;">
                <a href="${escapeHtml(fileUrl)}" target="_blank"
                  style="display:inline-block;padding:8px 14px;background:#5f4bd8;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
                  📎 Atvērt failu
                </a>
              </div>
            `
          }

          // ❌ skip duplicate filename
          if (key === 'Fails') return ''
          if (key.startsWith('__')) return ''

          // ✅ normal options
          return `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`
        })
        .join('')

      return `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e7e2db;">
          <div style="font-weight:700;font-size:14px;">${escapeHtml(item.name)} × ${escapeHtml(item.quantity)}</div>
          <div style="color:#6b6490;font-size:13px;margin-bottom:6px;">
            Cena: ${(Number(item.price) * item.quantity * 1.21).toFixed(2)} EUR
          </div>
          ${options}
        </div>
      `
    })
    .join('')

  return {
    subtotal,
    shipping,
    totalVat,
    totalWithVat,
    lines,
    htmlItems,
  }
}

export async function sendOwnerOrderNotification({ order, cart, attachments = [], db = null }) {
  const orderReference = order.publicId || String(order.id)
  const { subtotal, shipping, totalVat, totalWithVat, lines, htmlItems, } = getOrderSummaries({ order, cart })
  const subject = `Jauns pasūtījums #${orderReference} - ${order.name}`
  const text = [
    `Saņemts jauns pasūtījums #${orderReference}.`,
    '',
    `Klients: ${order.name}`,
    `E-pasts: ${order.email}`,
    `Tālrunis: ${order.phone || '-'}`,
    `Adrese: ${order.address || '-'}${order.city ? `, ${order.city}` : ''}${order.zip ? `, ${order.zip}` : ''}`,
    '',
    'Preces:',
    lines.join('\n\n'),
    '',
    `Bez PVN: ${subtotal.toFixed(2)} EUR`,
    `Piegāde: ${shipping.toFixed(2)} EUR`,
    `PVN 21%: ${totalVat.toFixed(2)} EUR`,
    `Kopā ar PVN: ${totalWithVat.toFixed(2)} EUR`,
    '',
    order.note ? `Piezīmes:\n${order.note}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <h2>Saņemts jauns pasūtījums #${orderReference}</h2>
    <p><strong>Klients:</strong> ${escapeHtml(order.name)}</p>
    <p><strong>E-pasts:</strong> ${escapeHtml(order.email)}</p>
    <p><strong>Tālrunis:</strong> ${escapeHtml(order.phone || '-')}</p>
    <p><strong>Adrese:</strong> ${escapeHtml(`${order.address || '-'}${order.city ? `, ${order.city}` : ''}${order.zip ? `, ${order.zip}` : ''}`)}</p>
    <h3>Preces</h3>
    ${htmlItems}
    <p><strong>Bez PVN:</strong> ${subtotal.toFixed(2)} EUR</p>
    <p><strong>Piegāde:</strong> ${shipping.toFixed(2)} EUR</p>
    <p><strong>PVN 21%:</strong> ${totalVat.toFixed(2)} EUR</p>
    <p><strong>Kopā ar PVN:</strong> ${totalWithVat.toFixed(2)} EUR</p>
    ${order.note ? `<p><strong>Piezīmes:</strong><br>${escapeHtmlWithLineBreaks(order.note)}</p>` : ''}
  `

  return sendOwnerNotificationMail({ subject, text, html, attachments, db })
}

export async function sendCustomerOrderConfirmation({ order, cart }) {
  const orderReference = order.publicId || String(order.id)

  const {
    subtotal,
    shipping,
    totalVat,
    totalWithVat
  } = getOrderSummaries({ order, cart })

  const subject = `Paldies par pasūtījumu #${orderReference}`

  // ✅ CLEAN TEXT VERSION (fallback)
  const text = `
Paldies par pasūtījumu #${orderReference}

Esam saņēmuši jūsu pasūtījumu un drīzumā sazināsimies.

--- Pasūtījums ---
${cart.map(item =>
  `${item.name} x ${item.quantity} — ${(Number(item.price) * item.quantity * 1.21).toFixed(2)} €`
).join('\n')}

--- Kopsumma ---
Bez PVN: ${subtotal.toFixed(2)} €
Piegāde: ${shipping.toFixed(2)} €
PVN (21%): ${totalVat.toFixed(2)} €
Kopā: ${totalWithVat.toFixed(2)} €

Ja jums ir jautājumi — vienkārši atbildiet uz šo e-pastu.
`.trim()
   

  // ✅ HTML FROM ETA TEMPLATE
  let html

  try {
    html = await eta.renderAsync('admin/customer-order', {
      order,
      orderReference,
      cart,
      subtotal,
      shipping,
      totalVat,
      totalWithVat
    })
  } catch (err) {
    console.error('EMAIL TEMPLATE ERROR:', err)

    // ✅ fallback so email STILL sends
    html = `
      <h2>Paldies par pasūtījumu #${orderReference}</h2>
      <p>Kopā: ${totalWithVat.toFixed(2)} €</p>
    `

  }

  return sendMail({
    to: order.email,
    subject,
    text,
    html
  })

}
