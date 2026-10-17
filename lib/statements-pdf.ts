// Relevés bancaires du mois réunis en un seul PDF pour le comptable : une page de garde
// (relevé déposé ou manquant pour chaque banque), puis les relevés à la suite.
// Généré entièrement dans le navigateur (pdf-lib).
import { dataUrlToBlob } from '@/lib/attachments'
import { clean } from '@/lib/pdf-utils'

const A4: [number, number] = [595.28, 841.89]
const M = 48

export interface StatementFile { bank: string; filename: string; data: string | null }

export async function buildStatementsPdf(files: StatementFile[], banks: string[], title: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.16, 0.16, 0.17), muted = rgb(0.52, 0.5, 0.48), accent = rgb(0.22, 0.19, 0.64), red = rgb(0.75, 0.2, 0.2)

  // Page de garde
  const cover = doc.addPage(A4)
  let y = A4[1] - M - 10
  cover.drawText('RIAD ANYSSATES', { x: M, y, size: 11, font: bold, color: accent })
  y -= 30
  cover.drawText(clean(`Relevés bancaires - ${title}`), { x: M, y, size: 18, font: bold, color: ink })
  y -= 18
  cover.drawText(clean(`Édité le ${new Date().toLocaleDateString('fr-FR')}`), { x: M, y, size: 9, font, color: muted })
  y -= 40
  for (const bank of banks) {
    const mine = files.filter(f => f.bank === bank)
    cover.drawText(clean(bank), { x: M, y, size: 12, font: bold, color: ink })
    y -= 16
    if (mine.length === 0) { cover.drawText('Relevé manquant', { x: M + 14, y, size: 10, font: bold, color: red }); y -= 14 }
    for (const f of mine) {
      const pdfable = !!f.data && /^data:(application\/pdf|image\/)/.test(f.data)
      cover.drawText(clean(`${f.filename}${pdfable ? '' : '  (fichier Excel/CSV : à envoyer à part)'}`), { x: M + 14, y, size: 10, font, color: pdfable ? ink : red, maxWidth: A4[0] - 2 * M - 14 })
      y -= 14
    }
    y -= 14
  }

  // Relevés à la suite
  for (const f of files) {
    if (!f.data) continue
    const head = clean(`${f.bank} - ${f.filename}`)
    const blob = dataUrlToBlob(f.data)
    try {
      if (blob.type === 'application/pdf') {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        const pages = await doc.copyPages(src, src.getPageIndices())
        pages.forEach((p, k) => {
          doc.addPage(p)
          if (k === 0) {
            const { width, height } = p.getSize()
            p.drawRectangle({ x: 0, y: height - 16, width, height: 16, color: rgb(1, 1, 1), opacity: 0.85 })
            p.drawText(head, { x: 8, y: height - 12, size: 8, font: bold, color: accent, maxWidth: width - 16 })
          }
        })
      } else if (blob.type === 'image/jpeg' || blob.type === 'image/png') {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const img = blob.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const page = doc.addPage(A4)
        page.drawText(head, { x: M, y: A4[1] - M, size: 10, font: bold, color: accent })
        const maxW = A4[0] - 2 * M, maxH = A4[1] - 2 * M - 24
        const s = Math.min(maxW / img.width, maxH / img.height, 1)
        page.drawImage(img, { x: (A4[0] - img.width * s) / 2, y: A4[1] - M - 24 - img.height * s, width: img.width * s, height: img.height * s })
      }
    } catch {
      const page = doc.addPage(A4)
      page.drawText(head, { x: M, y: A4[1] - M, size: 10, font: bold, color: accent })
      page.drawText("Relevé illisible dans l'export : le consulter dans l'application.", { x: M, y: A4[1] - M - 30, size: 10, font: bold, color: red })
    }
  }

  doc.setTitle(clean(`Relevés bancaires - ${title}`))
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}
