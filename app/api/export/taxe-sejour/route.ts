import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { QUARTER_LABELS } from '@/lib/invoice'
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

    const rows = await sql`SELECT * FROM invoices WHERE date >= ${from} AND date <= ${to} AND tax_amount > 0 ORDER BY date, seq`

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Taxe de séjour T${quarter} ${year}`)
    ws.columns = [
      { width: 12 }, { width: 15 }, { width: 30 }, { width: 11 }, { width: 8 }, { width: 16 }, { width: 10 }, { width: 15 }, { width: 8 },
    ]
    ws.mergeCells('A1:I1')
    ws.getCell('A1').value = `RIAD ANYSSATES — Relevé de la taxe de séjour — ${QUARTER_LABELS[quarter]} ${year}`
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF9E1C21' } }
    ws.getRow(1).height = 22

    const head = ws.getRow(3)
    ;['Date', 'N° facture', 'Client', 'Personnes', 'Nuits', 'Personnes × nuits', 'Tarif', 'Taxe de séjour', 'Devise'].forEach((t, i) => {
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
        Number(inv.persons), Number(inv.nights),
        { formula: `D${r}*E${r}`, result: Number(inv.nights) * Number(inv.persons) },
        Number(inv.tax_rate), Number(inv.tax_amount),
        (inv.tax_currency as string) || 'MAD',
      ]
      row.getCell(1).numFmt = 'dd/mm/yyyy'
      row.getCell(7).numFmt = '#,##0.00'
      row.getCell(8).numFmt = '#,##0.00'
      r++
    }
    const totalRow = ws.getRow(r + 1)
    const last = Math.max(r - 1, 4)
    totalRow.getCell(3).value = 'TOTAL'
    totalRow.getCell(4).value = { formula: `SUM(D4:D${last})` }
    totalRow.getCell(6).value = { formula: `SUM(F4:F${last})` }
    totalRow.getCell(8).value = { formula: `SUM(H4:H${last})` }
    totalRow.getCell(8).numFmt = '#,##0.00'
    totalRow.getCell(9).value = (rows[0]?.tax_currency as string) || 'EUR'
    totalRow.font = { bold: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Taxe-sejour-T${quarter}-${year}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('GET export taxe-sejour error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
