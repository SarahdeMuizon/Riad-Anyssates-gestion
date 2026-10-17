import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { QUARTER_LABELS, TAXE_LABEL } from '@/lib/invoice'
import { cleanupOrphanInvoices } from '@/lib/invoice-db'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// Relevé trimestriel de la taxe de séjour (fichier Excel pour le comptable)
export async function GET(req: NextRequest) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || '', 10)
    const quarter = parseInt(searchParams.get('quarter') || '', 10)
    if (!year || quarter < 1 || quarter > 4) return NextResponse.json({ error: 'Trimestre invalide' }, { status: 400 })
    const from = `${year}-${String(quarter * 3 - 2).padStart(2, '0')}-01`
    const to = `${year}-${String(quarter * 3).padStart(2, '0')}-31`

    await cleanupOrphanInvoices()
    const rows = await sql`SELECT * FROM invoices WHERE date >= ${from} AND date <= ${to} AND tax_amount > 0 AND COALESCE(cancelled, 0) = 0 ORDER BY date, seq`

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Taxe de séjour T${quarter} ${year}`)
    ws.columns = [
      { width: 12 }, { width: 15 }, { width: 28 }, { width: 9 }, { width: 11 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 8 },
    ]
    ws.mergeCells('A1:K1')
    ws.getCell('A1').value = `RIAD ANYSSATES — ${TAXE_LABEL} — ${QUARTER_LABELS[quarter]} ${year}`
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF9E1C21' } }
    ws.getRow(1).height = 22

    const head = ws.getRow(3)
    ;['Date', 'N° facture', 'Client', 'Adultes', 'Enfants (- 12 ans)', 'Nuits', 'Nuitées', 'Tarif adulte', 'Tarif enfant', 'Taxe', 'Devise'].forEach((t, i) => {
      const c = head.getCell(i + 1)
      c.value = t
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9E1C21' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    let r = 4
    for (const inv of rows) {
      const row = ws.getRow(r)
      row.values = [
        new Date(`${inv.date}T00:00:00Z`),
        inv.number as string,
        (inv.client_name as string) || '',
        Number(inv.persons), Number(inv.children || 0), Number(inv.nights),
        { formula: `(D${r}+E${r})*F${r}`, result: Number(inv.nights) * (Number(inv.persons) + Number(inv.children || 0)) },
        Number(inv.tax_rate), Number(inv.child_rate || 0), Number(inv.tax_amount),
        (inv.tax_currency as string) || 'MAD',
      ]
      row.getCell(1).numFmt = 'dd/mm/yyyy'
      for (const k of [8, 9, 10]) row.getCell(k).numFmt = '#,##0.00'
      r++
    }
    const totalRow = ws.getRow(r + 1)
    const last = Math.max(r - 1, 4)
    totalRow.getCell(3).value = 'TOTAL'
    totalRow.getCell(4).value = { formula: `SUM(D4:D${last})` }
    totalRow.getCell(5).value = { formula: `SUM(E4:E${last})` }
    totalRow.getCell(7).value = { formula: `SUM(G4:G${last})` }
    totalRow.getCell(10).value = { formula: `SUM(J4:J${last})` }
    totalRow.getCell(10).numFmt = '#,##0.00'
    totalRow.getCell(11).value = 'MAD'
    totalRow.font = { bold: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Taxe-sejour-TPT-T${quarter}-${year}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('GET export taxe-sejour error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
