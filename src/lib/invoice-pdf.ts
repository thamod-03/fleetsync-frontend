import { jsPDF } from 'jspdf'
import type { CustomerPayment } from '../types/customer-billing.ts'

export interface InvoiceFonts { regular: string; bold: string }
let fonts: Promise<InvoiceFonts> | undefined
const base64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
async function loadFonts(): Promise<InvoiceFonts> {
  if (!fonts) fonts = Promise.all([
    new URL('../assets/auth/inter-400.ttf', import.meta.url),
    new URL('../assets/auth/inter-700.ttf', import.meta.url),
  ].map(async (url) => {
    const result = await fetch(url)
    if (!result.ok) throw new Error('Invoice font unavailable')
    return base64(new Uint8Array(await result.arrayBuffer()))
  })).then(([regular, bold]) => ({ regular, bold })).catch((error: unknown) => { fonts = undefined; throw error })
  return fonts
}

// Text is drawn directly, never interpreted as HTML. Caller supplies an authorized snapshot.
export async function generateInvoicePdf(data: CustomerPayment, suppliedFonts?: InvoiceFonts): Promise<Uint8Array<ArrayBuffer>> {
  const font = suppliedFonts ?? await loadFonts()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.addFileToVFS('Inter-Regular.ttf', font.regular); pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  pdf.addFileToVFS('Inter-Bold.ttf', font.bold); pdf.addFont('Inter-Bold.ttf', 'Inter', 'bold')
  pdf.setProperties({ title: `FleetSync invoice - ${data.payment.id}`, subject: 'Payment invoice', author: 'FleetSync' })
  const { details, quotation, payment } = data
  const money = (value: number) => `LKR ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  let y = 25
  const text = (value: string, x: number, size = 10, bold = false, width = 170) => {
    pdf.setFont('Inter', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(17, 24, 39)
    const lines = pdf.splitTextToSize(value, width) as string[]
    const lineHeight = size * 0.48
    for (const line of lines) {
      if (y > 260) { pdf.addPage(); y = 25 }
      pdf.text(line, x, y); y += lineHeight
    }
  }
  const row = (label: string, value: string) => {
    y += 3; text(label.toUpperCase(), 20, 8, true); text(value, 20, 10)
  }
  text('FleetSync', 20, 24, true)
  y += 4; text('PAYMENT INVOICE', 20, 14, true)
  row('Payment reference', payment.reference ?? payment.id)
  row('Recorded date', payment.completedAt ?? payment.createdAt ?? 'Not recorded')
  row('Billed to', `${details.company.name}\n${details.contact.name}${details.company.billingAddress ? `\n${details.company.billingAddress}` : ''}`)
  row('Order / quotation', `${details.order.id}\n${quotation.id}`)
  row('Route', `${details.order.pickupAddress ?? details.order.origin} to ${details.order.destinationAddress ?? details.order.destination}`)
  y += 8
  text('DESCRIPTION', 20, 9, true)
  const charges = quotation.charges
  const items: [string, number][] = charges ? [
    ['Distance charge', charges.distance], ['Load charge', charges.load], ['Loading and unloading', charges.loading], ['Handling', charges.handling], ['Tolls and fees', charges.tolls],
  ] : [['Transport fare (breakdown not recorded)', quotation.amount]]
  for (const [label, amount] of items) {
    if (y > 250) { pdf.addPage(); y = 25 }
    pdf.setDrawColor(227, 230, 235); pdf.line(20, y, 190, y); y += 6
    const start = y
    text(label, 20, 10, false, 108)
    const afterLabel = y; y = start; text(money(amount), 137, 10, false, 53); y = Math.max(y, afterLabel) + 3
  }
  y += 4; text(`TOTAL RECORDED  ${money(payment.amount)}`, 20, 15, true)
  row('Payment status / method', `Succeeded / ${payment.method ?? 'Not recorded'}${payment.cardLast4 ? ` ending ${payment.cardLast4}` : ''}`)
  y += 8
  text('This document records a local payment simulation. No funds were transferred. This is not a tax invoice; no tax rate, VAT or legal registration details are asserted.', 20, 8)
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFont('Inter', 'normal'); pdf.setFontSize(8); pdf.setTextColor(107, 114, 128)
    pdf.text(`FleetSync  |  Page ${page} of ${pages}`, 20, 285)
  }
  return new Uint8Array(pdf.output('arraybuffer'))
}
