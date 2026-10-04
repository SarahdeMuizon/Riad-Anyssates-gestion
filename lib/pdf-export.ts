// Export PDF « dossier comptable » : une page récapitulative puis tous les justificatifs,
// dans l'ordre chronologique. Généré entièrement dans le navigateur (pdf-lib).
import type { Entry } from '@/types'
import { dataUrlToBlob } from '@/lib/attachments'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 36

// Les polices standard des PDF ne gèrent que l'alphabet latin (WinAnsi) :
// on remplace les caractères qu'elles ne savent pas dessiner.
function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/↔/g, '<->').replace(/→/g, '->')
    .replace(/[−–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '')
}

const fmtAmount = (n: number) => clean(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fmtDate = (d: string) => d.split('-').reverse().join('/')

async function imageToJpegBytes(blob: Blob): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width; canvas.height = bmp.height
  canvas.getContext('2d')!.drawImage(bmp, 0, 0)
  const out: Blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('conversion image')), 'image/jpeg', 0.85))
  return new Uint8Array(await out.arrayBuffer())
}

export async function buildAccountantPdf(entries: Entry[], title: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const grey = rgb(0.4, 0.4, 0.4)
  const terracotta = rgb(0.63, 0.3, 0.17)

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const label = (e: Entry, n: number) => clean(
    `#${n} - ${fmtDate(e.date)} - ${e.type === 'cb' ? 'Dépense' : 'Encaissement'} - ${e.supplier || e.category}` +
    ` - ${fmtAmount(Number(e.amount))} ${e.currency || 'MAD'}${e.reference ? ` - N° ${e.reference}` : ''}`)

  // 1) Justificatifs, dans un document séparé pour connaître leur numéro de page
  const body = await PDFDocument.create()
  const bFont = await body.embedFont(StandardFonts.Helvetica)
  const firstPage: (number | null)[] = []
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]
    const url = e.invoice_url as string | undefined
    if (!url || !url.startsWith('data:')) { firstPage.push(null); continue }
    firstPage.push(body.getPageCount())
    const head = label(e, i + 1)
    try {
      const blob = dataUrlToBlob(url)
      if (blob.type === 'application/pdf') {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        const pages = await body.copyPages(src, src.getPageIndices())
        pages.forEach((p, k) => {
          body.addPage(p)
          if (k === 0) {
            const { width, height } = p.getSize()
            p.drawRectangle({ x: 0, y: height - 16, width, height: 16, color: rgb(1, 1, 1), opacity: 0.85 })
            p.drawText(head, { x: 8, y: height - 12, size: 8, font: bFont, color: terracotta, maxWidth: width - 16 })
          }
        })
      } else {
        const bytes = blob.type === 'image/jpeg' || blob.type === 'image/png'
          ? new Uint8Array(await blob.arrayBuffer())
          : await imageToJpegBytes(blob)
        const img = blob.type === 'image/png' ? await body.embedPng(bytes) : await body.embedJpg(bytes)
        const page = body.addPage(A4)
        page.drawText(head, { x: MARGIN, y: A4[1] - MARGIN, size: 10, font: bFont, color: terracotta, maxWidth: A4[0] - 2 * MARGIN })
        const maxW = A4[0] - 2 * MARGIN, maxH = A4[1] - 2 * MARGIN - 24
        const scale = Math.min(maxW / img.width, maxH / img.height, 1)
        const w = img.width * scale, h = img.height * scale
        page.drawImage(img, { x: (A4[0] - w) / 2, y: A4[1] - MARGIN - 24 - h, width: w, height: h })
      }
    } catch {
      const page = body.addPage(A4)
      page.drawText(head, { x: MARGIN, y: A4[1] - MARGIN, size: 10, font: bFont, color: terracotta, maxWidth: A4[0] - 2 * MARGIN })
      page.drawText("Justificatif illisible dans l'export : le consulter dans l'application.", { x: MARGIN, y: A4[1] - MARGIN - 30, size: 10, font: bFont })
    }
  }

  // 2) Récapitulatif (une ou plusieurs pages)
  const ROW_H = 15
  const cols = [
    { t: '#', w: 22 }, { t: 'Date', w: 54 }, { t: 'Type', w: 50 }, { t: 'Fournisseur / client', w: 110 },
    { t: 'Catégorie', w: 68 }, { t: 'Paiement', w: 52 }, { t: 'N° fact./chèque', w: 64 }, { t: 'Montant', w: 70 }, { t: 'Justif.', w: 33 },
  ]
  // Simulation de la mise en page, pour connaître le nombre de pages du récapitulatif
  // (et donc le numéro de page de chaque justificatif) avant de dessiner.
  const TOP_START = A4[1] - MARGIN - 26 - 18 - 16 - 26
  let summaryPages = 1
  {
    let yy = TOP_START - ROW_H
    for (let i = 0; i < sorted.length; i++) {
      if (yy < MARGIN + ROW_H) { summaryPages++; yy = A4[1] - MARGIN - ROW_H }
      yy -= ROW_H
    }
  }

  let page = doc.addPage(A4)
  let y = A4[1] - MARGIN
  page.drawText('Riad Anyssates', { x: MARGIN, y, size: 11, font: bold, color: terracotta })
  y -= 26
  page.drawText(clean(`Factures pour le comptable - ${title}`), { x: MARGIN, y, size: 17, font: bold })
  y -= 18
  page.drawText(clean(`${sorted.length} facture${sorted.length > 1 ? 's' : ''} - export du ${new Date().toLocaleDateString('fr-FR')}`), { x: MARGIN, y, size: 9, font, color: grey })
  y -= 16
  const totals: Record<string, { dep: number; enc: number }> = {}
  for (const e of sorted) {
    const c = e.currency || 'MAD'
    totals[c] = totals[c] || { dep: 0, enc: 0 }
    if (e.type === 'cb') totals[c].dep += Number(e.amount); else totals[c].enc += Number(e.amount)
  }
  const totalLine = Object.entries(totals).map(([c, t]) => `${c} : dépenses ${fmtAmount(t.dep)} / encaissements ${fmtAmount(t.enc)}`).join('   |   ')
  page.drawText(clean(totalLine), { x: MARGIN, y, size: 9, font: bold, maxWidth: A4[0] - 2 * MARGIN })
  y -= 26

  const drawHeader = () => {
    let x = MARGIN
    page.drawRectangle({ x: MARGIN - 2, y: y - 4, width: A4[0] - 2 * MARGIN + 4, height: ROW_H, color: rgb(0.96, 0.93, 0.89) })
    for (const c of cols) { page.drawText(clean(c.t), { x, y, size: 7.5, font: bold, color: terracotta }); x += c.w }
    y -= ROW_H
  }
  const fit = (s: string, w: number, f = font, size = 7.5) => {
    let t = clean(s)
    while (t.length > 1 && f.widthOfTextAtSize(t, size) > w - 4) t = t.slice(0, -1)
    return t !== clean(s) ? t.slice(0, -1) + '.' : t
  }
  drawHeader()
  sorted.forEach((e, i) => {
    if (y < MARGIN + ROW_H) { page = doc.addPage(A4); y = A4[1] - MARGIN; drawHeader() }
    const p = firstPage[i]
    const vals = [
      String(i + 1), fmtDate(e.date), e.type === 'cb' ? 'Dépense' : 'Encaiss.', e.supplier || '-', e.category,
      e.payment || '-', e.reference || '-', `${fmtAmount(Number(e.amount))} ${e.currency || 'MAD'}`,
      p === null ? 'manque' : `p. ${summaryPages + p + 1}`,
    ]
    let x = MARGIN
    vals.forEach((v, k) => {
      const missing = k === vals.length - 1 && p === null
      page.drawText(fit(v, cols[k].w), { x, y, size: 7.5, font: missing ? bold : font, color: missing ? rgb(0.75, 0.2, 0.2) : rgb(0.1, 0.1, 0.1) })
      x += cols[k].w
    })
    y -= ROW_H
  })

  // 3) Assemblage : récapitulatif puis justificatifs
  const bodyPages = await doc.copyPages(body, body.getPageIndices())
  bodyPages.forEach(p => doc.addPage(p))
  doc.setTitle(clean(`Factures comptable - ${title}`))
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
