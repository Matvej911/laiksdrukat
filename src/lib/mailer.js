import nodemailer from 'nodemailer'
import { Eta } from 'eta'

const viewsPath = path.join(process.cwd(), 'src/views')
import { getNotificationRecipients } from './notification-recipients.js'
import path from 'path'
const eta = new Eta({ views: viewsPath })
let cachedTransporter = null
let cachedTransporterKey = null

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
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  return {
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
  return getMailConfig().configured
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

async function sendMail({ to, subject, text, html, attachments = [] }) {
  const config = getMailConfig()
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
  })

  return { sent: true }
}

async function sendOwnerNotificationMail({ subject, text, html, attachments = [], db = null }) {
  const recipients = await getNotificationRecipients(db)

  if (recipients.length === 0) {
    return { sent: false, reason: 'no-recipients', recipients }
  }

  const result = await sendMail({
    to: recipients.map((entry) => entry.email).join(', '),
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
    <p><strong>Vārds:</strong> ${submission.name}</p>
    <p><strong>E-pasts:</strong> ${submission.email}</p>
    <p><strong>Tālrunis:</strong> ${submission.phone || '-'}</p>
    <p><strong>Ziņa:</strong></p>
    <p>${submission.message.replace(/\n/g, '<br>')}</p>
    <p><strong>Pielikums:</strong> ${submission.attachment ? submission.attachment.name : 'nav'}</p>
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
  const isOmniva = order.note?.includes('Omniva')
  const shipping = isOmniva ? 3.5 : 0

  const subtotal = Number(order.total) - shipping

  const totalVat = subtotal * 0.21
  const totalWithVat = subtotal + totalVat + shipping
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
                <a href="${fileUrl}" target="_blank"
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
          return `<div><strong>${key}:</strong> ${value}</div>`
        })
        .join('')

      return `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e7e2db;">
          <div style="font-weight:700;font-size:14px;">${item.name} × ${item.quantity}</div>
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
    <p><strong>Klients:</strong> ${order.name}</p>
    <p><strong>E-pasts:</strong> ${order.email}</p>
    <p><strong>Tālrunis:</strong> ${order.phone || '-'}</p>
    <p><strong>Adrese:</strong> ${order.address || '-'}${order.city ? `, ${order.city}` : ''}${order.zip ? `, ${order.zip}` : ''}</p>
    <h3>Preces</h3>
    ${htmlItems}
    <p><strong>Bez PVN:</strong> ${subtotal.toFixed(2)} EUR</p>
    <p><strong>Piegāde:</strong> ${shipping.toFixed(2)} EUR</p>
    <p><strong>PVN 21%:</strong> ${totalVat.toFixed(2)} EUR</p>
    <p><strong>Kopā ar PVN:</strong> ${totalWithVat.toFixed(2)} EUR</p>
    ${order.note ? `<p><strong>Piezīmes:</strong><br>${order.note.replace(/\n/g, '<br>')}</p>` : ''}
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
