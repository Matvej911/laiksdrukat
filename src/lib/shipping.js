export const VAT_RATE = 0.21
export const OMNIVA_DELIVERY_FEE = 3.5
export const FREE_OMNIVA_GROSS_THRESHOLD = 50

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100
}

export function calculateVat(subtotalExVat) {
  return toNumber(subtotalExVat) * VAT_RATE
}

export function calculateGrossSubtotal(subtotalExVat) {
  const subtotal = toNumber(subtotalExVat)
  return subtotal + calculateVat(subtotal)
}

export function qualifiesForFreeOmniva(subtotalExVat) {
  return roundMoney(calculateGrossSubtotal(subtotalExVat)) >= FREE_OMNIVA_GROSS_THRESHOLD
}

export function getOmnivaDeliveryFee(subtotalExVat) {
  return qualifiesForFreeOmniva(subtotalExVat) ? 0 : OMNIVA_DELIVERY_FEE
}

export function getDeliveryFee(subtotalExVat, deliveryType) {
  return deliveryType === 'omniva' ? getOmnivaDeliveryFee(subtotalExVat) : 0
}

export function getCheckoutTotals(subtotalExVat, deliveryType = 'pickup') {
  const subtotal = toNumber(subtotalExVat)
  const totalVat = calculateVat(subtotal)
  const subtotalWithVat = subtotal + totalVat
  const deliveryFee = getDeliveryFee(subtotal, deliveryType)

  return {
    subtotal,
    totalVat,
    subtotalWithVat,
    deliveryFee,
    totalWithVat: subtotalWithVat + deliveryFee,
    hasFreeOmnivaDelivery: qualifiesForFreeOmniva(subtotal),
    omnivaDeliveryFee: getOmnivaDeliveryFee(subtotal),
  }
}

export function isOmnivaOrder(order) {
  return /omniva/i.test(String(order?.note || ''))
}

export function getStoredOrderDeliveryFee(order) {
  if (!isOmnivaOrder(order)) {
    return 0
  }

  const note = String(order?.note || '').toLowerCase()

  if (note.includes('bezmaksas') || note.includes('+0,00') || note.includes('+0.00')) {
    return 0
  }

  return OMNIVA_DELIVERY_FEE
}

export function getStoredOrderTotals(order) {
  const shipping = getStoredOrderDeliveryFee(order)
  const subtotal = Math.max(0, toNumber(order?.total) - shipping)
  const totalVat = calculateVat(subtotal)
  const subtotalWithVat = subtotal + totalVat

  return {
    subtotal,
    shipping,
    totalVat,
    subtotalWithVat,
    totalWithVat: subtotalWithVat + shipping,
    isOmniva: isOmnivaOrder(order),
    hasFreeOmnivaDelivery: shipping === 0 && isOmnivaOrder(order),
  }
}
