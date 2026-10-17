// Factures de vente et relevé de taxe de séjour, au nom du riad
// (logo, numéro et date en en-tête, mentions légales ICE / RC / PT / IF en pied de page).
// Générés entièrement dans le navigateur (pdf-lib).
import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from 'pdf-lib'
import type { Invoice } from '@/lib/invoice'
import { QUARTER_LABELS, invoiceLines, lineTotals } from '@/lib/invoice'
import { clean, fmtAmount, fmtDate } from '@/lib/pdf-utils'

const A4: [number, number] = [595.28, 841.89]
const M = 48 // marge

const ADDRESS = '144 Derb el Bomba - Arset Ihiri - 40000 Marrakech Médina'
const CONTACT = 'Tél. +212 (0)5 24 38 17 38  -  contact@riadanyssates.com'
const LEGAL = 'ICE 001656831000023   -   RC 34571   -   PT 45605273   -   IF 40179446'

let logoBytes: Uint8Array | null = null
async function loadLogo(): Promise<Uint8Array> {
  if (!logoBytes) logoBytes = new Uint8Array(await (await fetch('/facture-logo.jpg')).arrayBuffer())
  return logoBytes
}

interface Kit {
  font: PDFFont; bold: PDFFont; italic: PDFFont; logo: PDFImage
  c: { accent: RGB; ink: RGB; muted: RGB; hair: RGB; soft: RGB; white: RGB }
}

async function kit(doc: PDFDocument): Promise<Kit> {
  const { StandardFonts, rgb } = await import('pdf-lib')
  return {
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    logo: await doc.embedJpg(await loadLogo()),
    c: {
      accent: rgb(0.757, 0.376, 0.227), // terracotta de l'application
      ink: rgb(0.16, 0.16, 0.17), muted: rgb(0.52, 0.5, 0.48), hair: rgb(0.9, 0.88, 0.86),
      soft: rgb(0.98, 0.965, 0.95), white: rgb(1, 1, 1),
    },
  }
}

const text = (page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB) =>
  page.drawText(clean(s), { x, y, size, font, color })
const right = (page: PDFPage, s: string, xRight: number, y: number, size: number, font: PDFFont, color: RGB) =>
  page.drawText(clean(s), { x: xRight - font.widthOfTextAtSize(clean(s), size), y, size, font, color })
const spaced = (s: string) => s.split('').join(' ').replace(/ {3}/g, '   ')

// En-tête : logo et nom du riad à gauche, titre du document à droite ; pied de page légal
function frame(page: PDFPage, k: Kit, title: string, meta: [string, string][], titleSize = 20) {
  const [W, H] = A4
  const { c } = k
  // Bandeau d'accent tout en haut
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: c.accent })
  const logoH = 74, logoW = logoH * k.logo.width / k.logo.height
  page.drawImage(k.logo, { x: M, y: H - 34 - logoH, width: logoW, height: logoH })
  const tx = M + logoW + 14
  text(page, spaced('RIAD ANYSSATES'), tx, H - 66, 13, k.bold, c.ink)
  text(page, "Maison d'hôtes  -  Marrakech Médina", tx, H - 82, 9, k.font, c.muted)

  right(page, title, W - M, H - 62, titleSize, k.bold, c.accent)
  let y = H - 82
  for (const [l, v] of meta) {
    const vw = k.bold.widthOfTextAtSize(clean(v), 9.5)
    right(page, v, W - M, y, 9.5, k.bold, c.ink)
    right(page, l, W - M - vw - 6, y, 9.5, k.font, c.muted)
    y -= 14
  }
  page.drawLine({ start: { x: M, y: H - 130 }, end: { x: W - M, y: H - 130 }, thickness: 0.8, color: c.hair })

  // Pied de page
  page.drawLine({ start: { x: M, y: 62 }, end: { x: W - M, y: 62 }, thickness: 0.8, color: c.hair })
  ;[[ `RIAD ANYSSATES  -  ${ADDRESS}`, k.bold ], [CONTACT, k.font], [LEGAL, k.font]].forEach(([s, f], i) => {
    const t = clean(s as string), font = f as PDFFont
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, 7.5)) / 2, y: 48 - i * 10.5, size: 7.5, font, color: c.muted })
  })
}

// ── Montant en toutes lettres (« Arrêtée la présente facture à la somme de … ») ──
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']
function below100(n: number): string {
  if (n <= 16) return UNITS[n]
  if (n < 20) return 'dix-' + UNITS[n - 10]
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return TENS[t] + (u === 0 ? '' : u === 1 ? ' et un' : '-' + UNITS[u]) }
  if (n < 80) return n === 71 ? 'soixante et onze' : 'soixante-' + below100(n - 60)
  return 'quatre-vingt' + (n === 80 ? 's' : '-' + below100(n - 80))
}
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100
  const head = h === 0 ? '' : h === 1 ? 'cent' : UNITS[h] + ' cent' + (r === 0 ? 's' : '')
  return [head, r || !head ? below100(r) : ''].filter(Boolean).join(' ')
}
export function numberToWords(n: number): string {
  if (n === 0) return 'zéro'
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000), thousands = Math.floor((n % 1_000_000) / 1000), rest = n % 1000
  if (millions) parts.push(below1000(millions) + (millions > 1 ? ' millions' : ' million'))
  if (thousands) parts.push(thousands === 1 ? 'mille' : below1000(thousands).replace(/(cent|vingt)s$/, '$1') + ' mille')
  if (rest) parts.push(below1000(rest))
  return parts.join(' ')
}
function amountInWords(amount: number, currency: string): string {
  const cents = Math.round(amount * 100)
  const units = Math.floor(cents / 100), dec = cents % 100
  const name = currency === 'EUR' ? ['euro', 'euros', 'centime', 'centimes'] : ['dirham', 'dirhams', 'centime', 'centimes']
  let s = `${numberToWords(units)} ${units > 1 ? name[1] : name[0]}`
  if (dec) s += ` et ${numberToWords(dec)} ${dec > 1 ? name[3] : name[2]}`
  return s
}


// Bandeau du total : discret, aligné sur les lignes au-dessus (libellé à xL, montant à droite)
function totalBand(page: PDFPage, k: Kit, label: string, value: string, xL: number, y: number) {
  const xR = A4[0] - M
  page.drawRectangle({ x: xL - 8, y: y - 7, width: xR - xL + 8, height: 22, color: k.c.accent })
  text(page, label, xL, y, 9, k.bold, k.c.white)
  let size = 11
  while (size > 8 && k.bold.widthOfTextAtSize(clean(value), size) > xR - 8 - xL - k.bold.widthOfTextAtSize(clean(label), 9) - 16) size -= 0.5
  right(page, value, xR - 8, y, size, k.bold, k.c.white)
}

const PAYMENT_LABELS: Record<string, string> = {
  CB: 'Carte bancaire', Virement: 'Virement bancaire', 'Chèque': 'Chèque', 'Prélèvement': 'Prélèvement', 'Espèces': 'Espèces',
}

async function drawInvoice(doc: PDFDocument, k: Kit, inv: Invoice) {
  const [W, H] = A4
  const { c } = k
  const page = doc.addPage(A4)
  const cur = inv.currency || 'MAD'
  const taxCur = inv.tax_currency || 'MAD'
  frame(page, k, 'FACTURE', [['N°', inv.number], ['Date', fmtDate(inv.date)]])
  const xR = W - M

  // Client et séjour
  let y = H - 162
  text(page, 'FACTURÉ À', M, y, 7.5, k.bold, c.muted)
  right(page, `Marrakech, le ${fmtDate(inv.date)}`, xR, y - 17, 10, k.font, c.muted)
  y -= 17
  text(page, inv.client_name || '-', M, y, 13, k.bold, c.ink)
  y -= 15
  if (inv.nights > 0 || inv.persons > 0) {
    text(page, `Séjour : ${inv.persons} personne${inv.persons > 1 ? 's' : ''}  -  ${inv.nights} nuit${inv.nights > 1 ? 's' : ''}`, M, y, 9.5, k.font, c.muted)
  }

  // Tableau des prestations
  y = H - 240
  const col = { tva: 360, ht: 450, ttc: xR }
  text(page, 'DÉSIGNATION', M, y, 7.5, k.bold, c.muted)
  right(page, 'TVA', col.tva, y, 7.5, k.bold, c.muted)
  right(page, 'MONTANT HT', col.ht, y, 7.5, k.bold, c.muted)
  right(page, 'MONTANT TTC', col.ttc, y, 7.5, k.bold, c.muted)
  y -= 8
  page.drawLine({ start: { x: M, y }, end: { x: xR, y }, thickness: 1.2, color: c.accent })

  const lines = invoiceLines(inv)
  const row = (label: string, sub: string, tva: string, ht: string, ttc: string) => {
    y -= 20
    text(page, label, M, y, 10.5, k.font, c.ink)
    right(page, tva, col.tva, y, 10, k.font, c.muted)
    right(page, ht, col.ht, y, 10, k.font, c.ink)
    right(page, ttc, col.ttc, y, 10, k.bold, c.ink)
    if (sub) { y -= 13; text(page, sub, M, y, 8.5, k.font, c.muted) }
    y -= 10
    page.drawLine({ start: { x: M, y }, end: { x: xR, y }, thickness: 0.5, color: c.hair })
  }
  for (const l of lines) {
    const ht = l.tva > 0 ? l.amount / (1 + l.tva / 100) : l.amount
    row(l.label, '', l.tva > 0 ? `${String(l.tva).replace('.', ',')} %` : '-', fmtAmount(ht), `${fmtAmount(l.amount)} ${cur}`)
  }
  const tax = Number(inv.tax_amount)
  if (tax > 0) {
    row('Taxe de séjour', `${inv.persons} pers. x ${inv.nights} nuit${inv.nights > 1 ? 's' : ''} x ${fmtAmount(Number(inv.tax_rate))} ${taxCur}${taxCur !== cur ? ' - hors total' : ''}`,
      '-', fmtAmount(tax), `${fmtAmount(tax)} ${taxCur}`)
  }

  // Totaux
  const t = lineTotals(lines)
  y -= 26
  const xL = 340
  const totalRow = (l: string, v: string) => {
    text(page, l, xL, y, 9.5, k.font, c.muted)
    right(page, v, xR - 8, y, 9.5, k.font, c.ink)
    y -= 16
  }
  totalRow('Total HT', `${fmtAmount(t.totalHT + (taxCur === cur ? tax : 0))} ${cur}`)
  totalRow('TVA', `${fmtAmount(t.totalTVA)} ${cur}`)
  if (tax > 0) totalRow('dont taxe de séjour', `${fmtAmount(tax)} ${taxCur}`)
  y -= 6
  totalBand(page, k, 'TOTAL TTC', `${fmtAmount(Number(inv.amount_total))} ${cur}`, xL, y)

  // Bas de page : montant en lettres et mode de règlement
  const by = 104
  page.drawRectangle({ x: M, y: by, width: xR - M, height: 66, color: c.soft })
  text(page, 'Arrêtée la présente facture à la somme de :', M + 14, by + 48, 8.5, k.font, c.muted)
  const words = amountInWords(Number(inv.amount_total), cur)
  page.drawText(clean(words.charAt(0).toUpperCase() + words.slice(1) + '.'), { x: M + 14, y: by + 33, size: 10, font: k.bold, color: c.ink, maxWidth: xR - M - 28 })
  page.drawLine({ start: { x: M + 14, y: by + 24 }, end: { x: xR - 14, y: by + 24 }, thickness: 0.5, color: c.hair })
  text(page, 'Règlement :', M + 14, by + 10, 9, k.font, c.muted)
  text(page, `${PAYMENT_LABELS[inv.payment || ''] || inv.payment || '-'}  -  le ${fmtDate(inv.date)}`, M + 14 + k.font.widthOfTextAtSize('Règlement :', 9) + 6, by + 10, 9.5, k.bold, c.ink)

  // Remerciement
  const thanks = 'Merci pour votre séjour au Riad Anyssates'
  page.drawText(clean(thanks), { x: (W - k.italic.widthOfTextAtSize(clean(thanks), 9.5)) / 2, y: 80, size: 9.5, font: k.italic, color: c.accent })
}

export async function buildInvoicePdf(inv: Invoice): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  await drawInvoice(doc, await kit(doc), inv)
  doc.setTitle(clean(`Facture ${inv.number}`))
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}

// Pour ajouter des pages de facture à un PDF existant (export du dossier comptable)
export async function invoicePageWriter(doc: PDFDocument) {
  let k: Kit | null = null
  return async (inv: Invoice) => {
    if (!k) k = await kit(doc)
    await drawInvoice(doc, k, inv)
  }
}

// Relevé trimestriel de la taxe de séjour
export async function buildTaxeSejourPdf(invoices: Invoice[], year: number, quarter: number): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const k = await kit(doc)
  const { c } = k
  const [W, H] = A4
  const xR = W - M
  const today = fmtDate(new Date().toISOString().split('T')[0])
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq)

  const cols = [
    // Relevé destiné à l'administration : pas de nom de client
    { t: 'DATE', w: 80, r: false }, { t: 'N° FACTURE', w: 100, r: false },
    { t: 'PERSONNES', w: 75, r: true }, { t: 'NUITS', w: 60, r: true }, { t: 'PERS. x NUITS', w: 85, r: true }, { t: 'TAXE', w: xR - M - 400, r: true },
  ]
  let page = doc.addPage(A4)
  let y = 0
  const header = () => {
    let x = M
    for (const col of cols) {
      if (col.r) right(page, col.t, x + col.w, y, 7.5, k.bold, c.muted)
      else text(page, col.t, x, y, 7.5, k.bold, c.muted)
      x += col.w
    }
    y -= 8
    page.drawLine({ start: { x: M, y }, end: { x: xR, y }, thickness: 1.2, color: c.accent })
  }
  const newPage = (first: boolean) => {
    if (!first) page = doc.addPage(A4)
    frame(page, k, 'Taxe de séjour', [['Période', `T${quarter} ${year}`], ['Édité le', today]], 15)
    y = H - 162
    if (first) {
      text(page, `Relevé du ${QUARTER_LABELS[quarter]} ${year}`, M, y, 13, k.bold, c.ink)
      y -= 34
    }
    header()
  }
  newPage(true)

  let nuitees = 0, persons = 0
  const totals: Record<string, number> = {}
  for (const inv of sorted) {
    if (y < 150) newPage(false)
    const n = inv.nights * inv.persons
    const taxCur = inv.tax_currency || 'MAD'
    nuitees += n; persons += inv.persons
    totals[taxCur] = (totals[taxCur] || 0) + Number(inv.tax_amount)
    const vals = [fmtDate(inv.date), inv.number, String(inv.persons), String(inv.nights), String(n), `${fmtAmount(Number(inv.tax_amount))} ${taxCur}`]
    y -= 17
    let x = M
    vals.forEach((v, i) => {
      let t = clean(v)
      while (t.length > 1 && k.font.widthOfTextAtSize(t, 9) > cols[i].w - 6) t = t.slice(0, -1)
      const f = i === vals.length - 1 ? k.bold : k.font
      if (cols[i].r) page.drawText(t, { x: x + cols[i].w - f.widthOfTextAtSize(t, 9), y, size: 9, font: f, color: c.ink })
      else page.drawText(t, { x, y, size: 9, font: f, color: c.ink })
      x += cols[i].w
    })
    y -= 7
    page.drawLine({ start: { x: M, y }, end: { x: xR, y }, thickness: 0.5, color: c.hair })
  }

  if (y < 190) newPage(false)
  y -= 34
  const xL = 300
  const line = (l: string, v: string) => { text(page, l, xL, y, 9.5, k.font, c.muted); right(page, v, xR - 8, y, 9.5, k.font, c.ink); y -= 16 }
  line('Factures', String(sorted.length))
  line('Personnes', String(persons))
  line('Nuitées (personnes x nuits)', String(nuitees))
  y -= 6
  totalBand(page, k, 'TAXE À REVERSER', Object.entries(totals).map(([cur, v]) => `${fmtAmount(v)} ${cur}`).join(' + ') || '0,00 MAD', xL, y)

  doc.setTitle(clean(`Taxe de séjour - T${quarter} ${year}`))
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}
