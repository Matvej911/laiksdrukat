import nodemailer from 'nodemailer'

import { getNotificationRecipients } from './notification-recipients.js'

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
    return null
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
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

async function sendOwnerNotificationMail({ subject, text, html, attachments = [] }) {
  const recipients = await getNotificationRecipients()

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
    .filter(([key]) => key !== 'Faila saite')
    .map(([key, value]) => `- ${key}: ${value}`)
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
  })
}

function getOrderSummaries({ order, cart }) {
  const totalVat = Number(order.total) * 0.21
  const totalWithVat = Number(order.total) + totalVat
  const lines = cart.map((item) => {
    const options = formatOrderOptions(item.options)

    return [
      `${item.name} x ${item.quantity}`,
      `Cena bez PVN: ${(Number(item.price) * item.quantity).toFixed(2)} EUR`,
      options,
    ]
      .filter(Boolean)
      .join('\n')
  })

  const htmlItems = cart
    .map((item) => {
      const options = Object.entries(item.options || {})
        .filter(([key]) => key !== 'Faila saite')
        .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
        .join('')

      return `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e7e2db;">
          <div><strong>${item.name}</strong> × ${item.quantity}</div>
          <div>Cena bez PVN: ${(Number(item.price) * item.quantity).toFixed(2)} EUR</div>
          ${options}
        </div>
      `
    })
    .join('')

  return {
    totalVat,
    totalWithVat,
    lines,
    htmlItems,
  }
}

export async function sendOwnerOrderNotification({ order, cart }) {
  const orderReference = order.publicId || String(order.id)
  const { totalVat, totalWithVat, lines, htmlItems } = getOrderSummaries({ order, cart })
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
    `Bez PVN: ${Number(order.total).toFixed(2)} EUR`,
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
    <p><strong>Bez PVN:</strong> ${Number(order.total).toFixed(2)} EUR</p>
    <p><strong>PVN 21%:</strong> ${totalVat.toFixed(2)} EUR</p>
    <p><strong>Kopā ar PVN:</strong> ${totalWithVat.toFixed(2)} EUR</p>
    ${order.note ? `<p><strong>Piezīmes:</strong><br>${order.note.replace(/\n/g, '<br>')}</p>` : ''}
  `

  return sendOwnerNotificationMail({ subject, text, html })
}

export async function sendCustomerOrderConfirmation({ order, cart }) {
  const orderReference = order.publicId || String(order.id)
  const { totalVat, totalWithVat, htmlItems } = getOrderSummaries({ order, cart })
  const subject = `Paldies par pasūtījumu #${orderReference}`
  const text = [
    `Paldies par jūsu pasūtījumu #${orderReference}.`,
    '',
    'Esam saņēmuši jūsu pasūtījumu un drīzumā sazināsimies, lai apstiprinātu detaļas.',
    '',
    'Pasūtījuma kopsavilkums:',
    ...cart.map((item) => `${item.name} x ${item.quantity} — ${(Number(item.price) * item.quantity * 1.21).toFixed(2)} EUR ar PVN`),
    '',
    `Bez PVN: ${Number(order.total).toFixed(2)} EUR`,
    `PVN 21%: ${totalVat.toFixed(2)} EUR`,
    `Kopā ar PVN: ${totalWithVat.toFixed(2)} EUR`,
    '',
    'Ja jums rodas jautājumi, atbildiet uz šo e-pastu vai sazinieties ar mums pa tālruni.',
  ].join('\n')

  const html = `
    <h2>Paldies par jūsu pasūtījumu #${orderReference}</h2>
    <p>Esam saņēmuši jūsu pasūtījumu un drīzumā sazināsimies, lai apstiprinātu detaļas.</p>
    <h3>Pasūtījuma kopsavilkums</h3>
    ${htmlItems}
    <p><strong>Bez PVN:</strong> ${Number(order.total).toFixed(2)} EUR</p>
    <p><strong>PVN 21%:</strong> ${totalVat.toFixed(2)} EUR</p>
    <p><strong>Kopā ar PVN:</strong> ${totalWithVat.toFixed(2)} EUR</p>
    <p>Ja jums rodas jautājumi, atbildiet uz šo e-pastu vai sazinieties ar mums pa tālruni.</p>
  `

  return sendMail({
    to: order.email,
    subject,
    text,
    html,
  })
}
