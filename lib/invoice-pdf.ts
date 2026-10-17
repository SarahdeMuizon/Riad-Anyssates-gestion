// Factures de vente et relevé de taxe de séjour, sur le papier à en-tête du riad
// (logo en haut à gauche, « Marrakech le … », mentions légales en pied de page).
// Générés entièrement dans le navigateur (pdf-lib).
import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from 'pdf-lib'
import type { Invoice } from '@/lib/invoice'
import { QUARTER_LABELS } from '@/lib/invoice'
import { clean, fmtAmount, fmtDate } from '@/lib/pdf-utils'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 70.9 // 2,5 cm, comme le modèle Word

const FOOTER = [
  'RIAD ANYSSATES  -  144 Derb el Bomba - Arset Ihiri - 40000 Marrakech Médina',
  'Tél : +212 (0)5.24.38.17.38   -   riadanyssates@gmail.com',
  'ICE : 001656831000023     RC : 34571     PT : 45605273     IF : 40179446',
]

let logoBytes: Uint8Array | null = null
async function loadLogo(): Promise<Uint8Array> {
  if (!logoBytes) logoBytes = new Uint8Array(await (await fetch('/facture-logo.jpg')).arrayBuffer())
  return logoBytes
}

interface Kit { font: PDFFont; bold: PDFFont; logo: PDFImage }

async function kit(doc: PDFDocument): Promise<Kit> {
  const { StandardFonts } = await import('pdf-lib')
  return {
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    logo: await doc.embedJpg(await loadLogo()),
  }
}

async function colors() {
  const { rgb } = await import('pdf-lib')
  return { white: rgb(1, 1, 1), red: rgb(0.62, 0.11, 0.13), grey: rgb(0.42, 0.42, 0.42), text: rgb(0.12, 0.12, 0.12), line: rgb(0.85, 0.82, 0.8), band: rgb(0.97, 0.95, 0.93) }
}

async function letterhead(page: PDFPage, k: Kit, date: string) {
  const c = await colors()
  const [W, H] = A4
  page.drawImage(k.logo, { x: 34, y: H - 36.6 - 87.4, width: 129.6, height: 87.4 })
  const town = clean(`Marrakech le ${fmtDate(date)}`)
  page.drawText(town, { x: W - MARGIN - k.font.widthOfTextAtSize(town, 11), y: H - MARGIN - 8, size: 11, font: k.font, color: c.text })
  FOOTER.forEach((line, i) => {
    const t = clean(line)
    const f = i === 0 ? k.bold : k.font
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, 8.5)) / 2, y: 44 - i * 11, size: 8.5, font: f, color: c.grey })
  })
  page.drawLine({ start: { x: MARGIN, y: 58 }, end: { x: W - MARGIN, y: 58 }, thickness: 0.6, color: c.line })
}

const right = (page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color: RGB) =>
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color })

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

async function drawInvoice(doc: PDFDocument, k: Kit, inv: Invoice) {
  const c = await colors()
  const [W, H] = A4
  const page = doc.addPage(A4)
  await letterhead(page, k, inv.date)
  const cur = inv.currency || 'MAD'
  const xR = W - MARGIN

  let y = H - 170
  page.drawText(clean(`FACTURE N° ${inv.number}`), { x: MARGIN, y, size: 18, font: k.bold, color: c.red })
  y -= 18
  page.drawText(clean(`Date : ${fmtDate(inv.date)}`), { x: MARGIN, y, size: 10, font: k.font, color: c.grey })

  // Bloc client
  const boxW = 185, boxX = xR - boxW
  page.drawRectangle({ x: boxX, y: H - 205, width: boxW, height: 52, borderColor: c.line, borderWidth: 0.8, color: c.band })
  page.drawText('CLIENT', { x: boxX + 10, y: H - 170, size: 8, font: k.bold, color: c.grey })
  page.drawText(clean(inv.client_name || '-'), { x: boxX + 10, y: H - 188, size: 11.5, font: k.bold, color: c.text, maxWidth: boxW - 20 })

  // Tableau des prestations
  y = H - 250
  const cols = { des: MARGIN, qty: 330, pu: 440, amt: xR }
  page.drawRectangle({ x: MARGIN - 4, y: y - 6, width: xR - MARGIN + 8, height: 20, color: c.red })
  const white = c.white
  page.drawText('Désignation', { x: cols.des, y, size: 9.5, font: k.bold, color: white })
  right(page, 'Quantité', cols.qty, y, 9.5, k.bold, white)
  right(page, clean('Prix unitaire'), cols.pu, y, 9.5, k.bold, white)
  right(page, 'Montant', cols.amt, y, 9.5, k.bold, white)
  y -= 26

  const lodging = Number(inv.amount_lodging)
  const tva = Number(inv.tva_rate) > 0 ? Math.round((lodging - lodging / (1 + Number(inv.tva_rate) / 100)) * 100) / 100 : 0
  const lodgingHT = Math.round((lodging - tva) * 100) / 100
  const row = (label: string, sub: string, qty: string, pu: string, amount: string, bold = false) => {
    const f = bold ? k.bold : k.font
    page.drawText(clean(label), { x: cols.des, y, size: 10, font: f, color: c.text, maxWidth: cols.qty - cols.des - 60 })
    if (qty) right(page, clean(qty), cols.qty, y, 10, k.font, c.text)
    if (pu) right(page, clean(pu), cols.pu, y, 10, k.font, c.text)
    right(page, clean(amount), cols.amt, y, 10, f, c.text)
    if (sub) { y -= 13; page.drawText(clean(sub), { x: cols.des, y, size: 8.5, font: k.font, color: c.grey, maxWidth: cols.qty - cols.des - 60 }) }
    y -= 10
    page.drawLine({ start: { x: MARGIN - 4, y }, end: { x: xR + 4, y }, thickness: 0.5, color: c.line })
    y -= 16
  }

  const stay = inv.nights > 0 ? `${inv.nights} nuit${inv.nights > 1 ? 's' : ''}${inv.persons > 0 ? ` - ${inv.persons} personne${inv.persons > 1 ? 's' : ''}` : ''}` : ''
  row(inv.description || 'Hébergement', stay, '1', fmtAmount(lodgingHT), `${fmtAmount(lodgingHT)} ${cur}`)
  if (tva > 0) {
    row(`TVA ${String(inv.tva_rate).replace('.', ',')} %`, '', '', '', `${fmtAmount(tva)} ${cur}`)
  }
  if (Number(inv.tax_amount) > 0) {
    const nuitees = inv.nights * inv.persons
    const taxCur = inv.tax_currency || 'MAD'
    const outside = cur !== taxCur
    row('Taxe de séjour', `${inv.persons} personne(s) x ${inv.nights} nuit(s)${outside ? ` - en ${taxCur}, hors total` : ''}`,
      `${nuitees} nuitée${nuitees > 1 ? 's' : ''}`, `${fmtAmount(Number(inv.tax_rate))} ${taxCur}`, `${fmtAmount(Number(inv.tax_amount))} ${taxCur}`)
  }

  // Total
  y -= 4
  page.drawRectangle({ x: 300, y: y - 8, width: xR - 300 + 4, height: 26, color: c.band, borderColor: c.red, borderWidth: 1 })
  page.drawText('TOTAL TTC', { x: 310, y, size: 12, font: k.bold, color: c.red })
  right(page, clean(`${fmtAmount(Number(inv.amount_total))} ${cur}`), xR - 6, y, 12, k.bold, c.red)
  y -= 40

  page.drawText(clean(`Mode de règlement : ${inv.payment || '-'}`), { x: MARGIN, y, size: 10, font: k.font, color: c.text })
  y -= 30
  page.drawText('Arrêtée la présente facture à la somme de :', { x: MARGIN, y, size: 10, font: k.font, color: c.text })
  y -= 15
  const words = amountInWords(Number(inv.amount_total), cur)
  page.drawText(clean(words.charAt(0).toUpperCase() + words.slice(1) + '.'), { x: MARGIN, y, size: 10, font: k.bold, color: c.text, maxWidth: xR - MARGIN, lineHeight: 13 })
  if (Number(inv.tax_amount) > 0 && Number(inv.tax_included) === 1) {
    y -= 30
    page.drawText(clean(`Dont taxe de séjour : ${fmtAmount(Number(inv.tax_amount))} ${inv.tax_currency || 'MAD'}.`), { x: MARGIN, y, size: 9, font: k.font, color: c.grey })
  }
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
  const c = await colors()
  const [W, H] = A4
  const xR = W - MARGIN
  const today = new Date().toISOString().split('T')[0]
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq)

  const cols = [
    { t: 'Date', w: 54, r: false }, { t: 'N° facture', w: 72, r: false }, { t: 'Client', w: 120, r: false },
    { t: 'Pers.', w: 36, r: true }, { t: 'Nuits', w: 36, r: true }, { t: 'Pers. x nuits', w: 60, r: true }, { t: 'Taxe', w: xR - MARGIN - 378, r: true },
  ]
  const ROW_H = 16
  let page = doc.addPage(A4)
  let y = 0
  const header = () => {
    let x = MARGIN
    page.drawRectangle({ x: MARGIN - 4, y: y - 5, width: xR - MARGIN + 8, height: ROW_H + 2, color: c.red })
    for (const col of cols) {
      const t = clean(col.t)
      page.drawText(t, { x: col.r ? x + col.w - k.bold.widthOfTextAtSize(t, 8.5) - 4 : x, y, size: 8.5, font: k.bold, color: c.white })
      x += col.w
    }
    y -= ROW_H + 4
  }
  const newPage = async (first: boolean) => {
    if (!first) page = doc.addPage(A4)
    await letterhead(page, k, today)
    y = H - 170
    if (first) {
      page.drawText('RELEVÉ DE LA TAXE DE SÉJOUR', { x: MARGIN, y, size: 17, font: k.bold, color: c.red })
      y -= 18
      page.drawText(clean(`${QUARTER_LABELS[quarter]} ${year}`), { x: MARGIN, y, size: 11, font: k.font, color: c.text })
      y -= 30
    }
    header()
  }
  await newPage(true)

  let nuitees = 0
  const totals: Record<string, number> = {}
  for (const inv of sorted) {
    if (y < 110) await newPage(false)
    const n = inv.nights * inv.persons
    const taxCur = inv.tax_currency || 'MAD'
    nuitees += n; totals[taxCur] = (totals[taxCur] || 0) + Number(inv.tax_amount)
    const vals = [fmtDate(inv.date), inv.number, inv.client_name || '-', String(inv.persons), String(inv.nights), String(n), `${fmtAmount(Number(inv.tax_amount))} ${taxCur}`]
    let x = MARGIN
    vals.forEach((v, i) => {
      let t = clean(v)
      while (t.length > 1 && k.font.widthOfTextAtSize(t, 9) > cols[i].w - 6) t = t.slice(0, -1)
      page.drawText(t, { x: cols[i].r ? x + cols[i].w - k.font.widthOfTextAtSize(t, 9) - 4 : x, y, size: 9, font: k.font, color: c.text })
      x += cols[i].w
    })
    y -= 6
    page.drawLine({ start: { x: MARGIN - 4, y }, end: { x: xR + 4, y }, thickness: 0.4, color: c.line })
    y -= ROW_H - 6
  }
  if (y < 150) await newPage(false)
  y -= 14
  page.drawRectangle({ x: MARGIN - 4, y: y - 40, width: xR - MARGIN + 8, height: 56, color: c.band, borderColor: c.red, borderWidth: 1 })
  page.drawText(clean(`${sorted.length} facture${sorted.length > 1 ? 's' : ''}  -  ${nuitees} nuitée${nuitees > 1 ? 's' : ''}`), { x: MARGIN + 6, y, size: 10, font: k.font, color: c.text })
  y -= 22
  page.drawText('TOTAL TAXE DE SÉJOUR', { x: MARGIN + 6, y, size: 12, font: k.bold, color: c.red })
  const totalLabel = Object.entries(totals).map(([cur, v]) => `${fmtAmount(v)} ${cur}`).join(' + ') || '0,00'
  right(page, clean(totalLabel), xR - 6, y, 12, k.bold, c.red)

  doc.setTitle(clean(`Taxe de séjour - T${quarter} ${year}`))
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}
