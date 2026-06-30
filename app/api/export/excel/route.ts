import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// Colors
const C_HEADER_BG = 'FF8B4513'   // terracotta
const C_HEADER_FG = 'FFFFFFFF'
const C_GREEN_BG  = 'FF2D6A4F'
const C_BLUE_BG   = 'FF3730A3'
const C_PURPLE_BG = 'FF6366F1'
const C_DASH_BG   = 'FFF8F9FA'
const C_TITLE_BG  = 'FFEDE0D6'
const C_ALT_ROW   = 'FFFAFAFA'

function hdr(cell: ExcelJS.Cell, text: string, bgColor = C_HEADER_BG, fgColor = C_HEADER_FG) {
  cell.value = text
  cell.font = { bold: true, color: { argb: fgColor }, name: 'Arial', size: 10 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
}

function cell(c: ExcelJS.Cell, value: unknown, bold = false, color?: string, align: 'left' | 'center' | 'right' = 'left') {
  c.value = value as ExcelJS.CellValue
  c.font = { name: 'Arial', size: 9, bold, ...(color ? { color: { argb: color } } : {}) }
  c.alignment = { horizontal: align, vertical: 'middle' }
}

function altRow(row: ExcelJS.Row, idx: number) {
  if (idx % 2 === 0) {
    row.eachCell(c => {
      const fill = c.fill as { type?: string; fgColor?: { argb?: string } }
      if (!fill || fill.fgColor?.argb === 'FFFFFFFF') {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ALT_ROW } }
      }
    })
  }
}

function addDashboard(ws: ExcelJS.Worksheet, title: string, byCategory: Record<string, number>, byMonth: Record<string, number>, totals: { label: string; value: number; color: string }[]) {
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 6
  ws.getColumn(4).width = 28
  ws.getColumn(5).width = 16

  // Title
  ws.mergeCells('A1:E1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `📊 Dashboard — ${title}`
  titleCell.font = { bold: true, size: 13, name: 'Arial', color: { argb: 'FF1F2937' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_TITLE_BG } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // KPI cards row
  let col = 1
  for (const t of totals) {
    const kCell = ws.getCell(3, col)
    kCell.value = t.label
    kCell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
    kCell.alignment = { horizontal: 'center' }
    const vCell = ws.getCell(4, col)
    vCell.value = t.value
    vCell.numFmt = '#,##0.00'
    vCell.font = { bold: true, size: 14, name: 'Arial', color: { argb: t.color } }
    vCell.alignment = { horizontal: 'center' }
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_DASH_BG } }
    col += 2
  }
  ws.getRow(4).height = 28

  // By category
  ws.getCell('A6').value = 'PAR CATÉGORIE'
  ws.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
  hdr(ws.getCell('A7'), 'Catégorie', C_HEADER_BG)
  hdr(ws.getCell('B7'), 'Montant', C_HEADER_BG)
  let r = 8
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  for (const [cat, total] of sortedCats) {
    cell(ws.getCell(r, 1), cat)
    const mc = ws.getCell(r, 2)
    mc.value = total
    mc.numFmt = '#,##0.00'
    mc.font = { name: 'Arial', size: 9, bold: true }
    mc.alignment = { horizontal: 'right' }
    altRow(ws.getRow(r), r)
    r++
  }
  // Total
  ws.getCell(r, 1).value = 'TOTAL'
  ws.getCell(r, 1).font = { bold: true, name: 'Arial', size: 9 }
  ws.getCell(r, 2).value = { formula: `SUM(B8:B${r - 1})` }
  ws.getCell(r, 2).numFmt = '#,##0.00'
  ws.getCell(r, 2).font = { bold: true, name: 'Arial', size: 9 }
  ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_TITLE_BG } }
  ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_TITLE_BG } }

  // By month
  const startCol = 4
  ws.getCell(6, startCol).value = 'PAR MOIS'
  ws.getCell(6, startCol).font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
  hdr(ws.getCell(7, startCol), 'Mois', C_BLUE_BG)
  hdr(ws.getCell(7, startCol + 1), 'Montant', C_BLUE_BG)
  let mr = 8
  for (const [month, total] of Object.entries(byMonth).sort()) {
    cell(ws.getCell(mr, startCol), month)
    const mc2 = ws.getCell(mr, startCol + 1)
    mc2.value = total
    mc2.numFmt = '#,##0.00'
    mc2.font = { name: 'Arial', size: 9, bold: true }
    mc2.alignment = { horizontal: 'right' }
    altRow(ws.getRow(mr), mr)
    mr++
  }
}

function formatMois(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()
}

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Fetch all data
    const [encaissements, depenses, fonds, settingsRows, baseFileRows] = await Promise.all([
      sql`SELECT * FROM entries WHERE type='cash' ORDER BY date ASC`,
      sql`SELECT * FROM entries WHERE type='cb' ORDER BY date ASC`,
      sql`SELECT * FROM fonds_entries ORDER BY date ASC`,
      sql`SELECT key, value FROM settings WHERE key IN ('fond_caisse_mad', 'fond_caisse_eur')`,
      sql`SELECT value FROM settings WHERE key = 'excel_base_file'`,
    ])

    const settings: Record<string, number> = { fond_caisse_mad: 2000, fond_caisse_eur: 200 }
    for (const r of settingsRows) settings[r.key as string] = parseFloat(r.value as string) || 0

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Riad Anyssates'
    wb.created = new Date()

    // Load base Excel file if uploaded, preserving existing sheets
    if (baseFileRows.length > 0 && baseFileRows[0].value) {
      const buf = Buffer.from(baseFileRows[0].value as string, 'base64')
      await wb.xlsx.load(buf)
      // Remove our managed sheets so we can regenerate them fresh
      const managed = ['Encaissements', 'Dashboard Encaissements', 'Dépenses', 'Dashboard Dépenses', 'Fond de caisse', 'Dashboard Fond de caisse']
      for (const name of managed) {
        const ws = wb.getWorksheet(name)
        if (ws) wb.removeWorksheet(ws.id)
      }
    }

    // ── Sheet: Encaissements ──────────────────────────────────────────────────
    const wsEnc = wb.addWorksheet('Encaissements', { views: [{ state: 'frozen', ySplit: 1 }] })
    wsEnc.columns = [
      { key: 'date', width: 12 },
      { key: 'mois', width: 16 },
      { key: 'employe', width: 18 },
      { key: 'categorie', width: 22 },
      { key: 'mode', width: 12 },
      { key: 'montant', width: 12 },
      { key: 'devise', width: 8 },
      { key: 'description', width: 28 },
      { key: 'statut', width: 12 },
      { key: 'ticket', width: 14 },
    ]
    const encHeaders = ['Date', 'Mois', 'Employé', 'Catégorie', 'Mode paiement', 'Montant', 'Devise', 'Description', 'Statut', 'Ticket CB']
    encHeaders.forEach((h, i) => hdr(wsEnc.getCell(1, i + 1), h, C_GREEN_BG))
    wsEnc.getRow(1).height = 22

    const encByCategory: Record<string, number> = {}
    const encByMonth: Record<string, number> = {}
    let encTotal = 0, encValidated = 0

    encaissements.forEach((e, idx) => {
      const row = wsEnc.addRow({})
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      cell(row.getCell(3), e.employee_name)
      cell(row.getCell(4), e.category)
      cell(row.getCell(5), e.payment || '—')
      const mc = row.getCell(6)
      mc.value = amt; mc.numFmt = '#,##0.00'; mc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D6A4F' } }; mc.alignment = { horizontal: 'right' }
      cell(row.getCell(7), (e.currency as string) || 'EUR', false, 'FF374151', 'center')
      cell(row.getCell(8), e.description || '')
      const status = e.status as string
      const sc = row.getCell(9)
      sc.value = status === 'validated' ? 'Validé' : 'En attente'
      sc.font = { name: 'Arial', size: 9, bold: true, color: { argb: status === 'validated' ? 'FF2D6A4F' : 'FFD97706' } }
      sc.alignment = { horizontal: 'center' }
      if (e.invoice_url) {
        const tc = row.getCell(10)
        tc.value = { text: '🧾 Voir ticket', hyperlink: e.invoice_url as string }
        tc.font = { name: 'Arial', size: 9, color: { argb: 'FF3730A3' }, underline: true }
      } else cell(row.getCell(10), '—', false, 'FF9CA3AF', 'center')
      altRow(row, idx + 2)
      encByCategory[e.category as string] = (encByCategory[e.category as string] || 0) + amt
      encByMonth[mois] = (encByMonth[mois] || 0) + amt
      encTotal += amt
      if (status === 'validated') encValidated += amt
    })
    wsEnc.autoFilter = { from: 'A1', to: 'J1' }

    // ── Dashboard Encaissements ───────────────────────────────────────────────
    const wsDashEnc = wb.addWorksheet('Dashboard Encaissements')
    addDashboard(wsDashEnc, 'Encaissements', encByCategory, encByMonth, [
      { label: 'Total', value: encTotal, color: 'FF2D6A4F' },
      { label: 'Validés', value: encValidated, color: 'FF3730A3' },
      { label: 'En attente', value: encTotal - encValidated, color: 'FFD97706' },
    ])

    // ── Sheet: Dépenses ───────────────────────────────────────────────────────
    const wsDep = wb.addWorksheet('Dépenses', { views: [{ state: 'frozen', ySplit: 1 }] })
    wsDep.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'employe', width: 18 },
      { key: 'categorie', width: 22 }, { key: 'fournisseur', width: 22 }, { key: 'mode', width: 12 },
      { key: 'montant', width: 12 }, { key: 'devise', width: 8 }, { key: 'description', width: 28 },
      { key: 'statut', width: 12 }, { key: 'facture', width: 14 },
    ]
    const depHeaders = ['Date', 'Mois', 'Employé', 'Catégorie', 'Fournisseur', 'Mode paiement', 'Montant', 'Devise', 'Description', 'Statut', 'Facture']
    depHeaders.forEach((h, i) => hdr(wsDep.getCell(1, i + 1), h, C_HEADER_BG))
    wsDep.getRow(1).height = 22

    const depByCategory: Record<string, number> = {}
    const depByMonth: Record<string, number> = {}
    let depTotal = 0, depValidated = 0

    depenses.forEach((e, idx) => {
      const row = wsDep.addRow({})
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      cell(row.getCell(3), e.employee_name)
      cell(row.getCell(4), e.category)
      cell(row.getCell(5), e.supplier || '—')
      cell(row.getCell(6), e.payment || '—')
      const mc = row.getCell(7)
      mc.value = amt; mc.numFmt = '#,##0.00'; mc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } }; mc.alignment = { horizontal: 'right' }
      cell(row.getCell(8), (e.currency as string) || 'EUR', false, 'FF374151', 'center')
      cell(row.getCell(9), e.description || '')
      const status = e.status as string
      const sc = row.getCell(10)
      sc.value = status === 'validated' ? 'Validé' : 'En attente'
      sc.font = { name: 'Arial', size: 9, bold: true, color: { argb: status === 'validated' ? 'FF2D6A4F' : 'FFD97706' } }
      sc.alignment = { horizontal: 'center' }
      if (e.invoice_url) {
        const fc = row.getCell(11)
        fc.value = { text: '📄 Voir facture', hyperlink: e.invoice_url as string }
        fc.font = { name: 'Arial', size: 9, color: { argb: 'FF3730A3' }, underline: true }
      } else cell(row.getCell(11), '—', false, 'FF9CA3AF', 'center')
      altRow(row, idx + 2)
      depByCategory[e.category as string] = (depByCategory[e.category as string] || 0) + amt
      depByMonth[mois] = (depByMonth[mois] || 0) + amt
      depTotal += amt
      if (status === 'validated') depValidated += amt
    })
    wsDep.autoFilter = { from: 'A1', to: 'K1' }

    // ── Dashboard Dépenses ────────────────────────────────────────────────────
    const wsDashDep = wb.addWorksheet('Dashboard Dépenses')
    addDashboard(wsDashDep, 'Dépenses', depByCategory, depByMonth, [
      { label: 'Total dépenses', value: depTotal, color: 'FF991B1B' },
      { label: 'Validées', value: depValidated, color: 'FF2D6A4F' },
      { label: 'En attente', value: depTotal - depValidated, color: 'FFD97706' },
    ])

    // ── Sheet: Fond de caisse ─────────────────────────────────────────────────
    const wsFonds = wb.addWorksheet('Fond de caisse', { views: [{ state: 'frozen', ySplit: 1 }] })
    wsFonds.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'sens', width: 10 },
      { key: 'categorie', width: 22 }, { key: 'employe', width: 18 },
      { key: 'montant', width: 12 }, { key: 'devise', width: 8 },
      { key: 'description', width: 28 }, { key: 'statut', width: 12 },
    ]
    const fondsHeaders = ['Date', 'Mois', 'Sens', 'Catégorie', 'Employé', 'Montant', 'Devise', 'Description', 'Statut']
    fondsHeaders.forEach((h, i) => hdr(wsFonds.getCell(1, i + 1), h, C_PURPLE_BG))
    wsFonds.getRow(1).height = 22

    // Dotation row
    wsFonds.addRow({})
    const dotRow = wsFonds.lastRow!
    dotRow.getCell(1).value = 'DOTATION INITIALE'
    dotRow.getCell(1).font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF4338CA' } }
    dotRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }
    dotRow.getCell(6).value = settings.fond_caisse_mad
    dotRow.getCell(6).numFmt = '#,##0.00'
    dotRow.getCell(6).font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF4338CA' } }
    dotRow.getCell(7).value = 'MAD'; dotRow.getCell(7).alignment = { horizontal: 'center' }
    dotRow.getCell(8).value = `+ ${settings.fond_caisse_eur.toFixed(2)} EUR`
    dotRow.getCell(8).font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF4338CA' } }

    const fondsByCategory: Record<string, number> = {}
    const fondsByMonth: Record<string, number> = {}
    let fondsIn = 0, fondsOut = 0

    fonds.forEach((e, idx) => {
      const row = wsFonds.addRow({})
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const isIn = (e.direction as string) === 'in'
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      const sc = row.getCell(3)
      sc.value = isIn ? '↑ Entrée' : '↓ Sortie'
      sc.font = { name: 'Arial', size: 9, bold: true, color: { argb: isIn ? 'FF2D6A4F' : 'FF991B1B' } }
      sc.alignment = { horizontal: 'center' }
      cell(row.getCell(4), e.category)
      cell(row.getCell(5), e.employee_name)
      const mc = row.getCell(6)
      mc.value = isIn ? amt : -amt; mc.numFmt = '#,##0.00'
      mc.font = { name: 'Arial', size: 9, bold: true, color: { argb: isIn ? 'FF2D6A4F' : 'FF991B1B' } }
      mc.alignment = { horizontal: 'right' }
      cell(row.getCell(7), (e.currency as string) || 'MAD', false, 'FF374151', 'center')
      cell(row.getCell(8), e.description || '')
      const stc = row.getCell(9)
      const status = e.status as string
      stc.value = status === 'validated' ? 'Validé' : 'En attente'
      stc.font = { name: 'Arial', size: 9, bold: true, color: { argb: status === 'validated' ? 'FF2D6A4F' : 'FFD97706' } }
      stc.alignment = { horizontal: 'center' }
      altRow(row, idx + 3)
      fondsByCategory[e.category as string] = (fondsByCategory[e.category as string] || 0) + amt
      fondsByMonth[mois] = (fondsByMonth[mois] || 0) + (isIn ? amt : -amt)
      if (isIn) fondsIn += amt; else fondsOut += amt
    })
    wsFonds.autoFilter = { from: 'A1', to: 'I1' }

    // ── Dashboard Fond de caisse ──────────────────────────────────────────────
    const wsDashFonds = wb.addWorksheet('Dashboard Fond de caisse')
    addDashboard(wsDashFonds, 'Fond de caisse', fondsByCategory, fondsByMonth, [
      { label: `Dotation MAD`, value: settings.fond_caisse_mad, color: 'FF4338CA' },
      { label: 'Entrées', value: fondsIn, color: 'FF2D6A4F' },
      { label: 'Sorties', value: fondsOut, color: 'FF991B1B' },
    ])
    // Add solde note
    const soldeRow = wsDashFonds.getRow(5)
    soldeRow.getCell(1).value = `Solde = Dotation (${settings.fond_caisse_mad} MAD + ${settings.fond_caisse_eur} EUR) + Entrées − Sorties`
    soldeRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }

    // Generate buffer and return
    const buffer = await wb.xlsx.writeBuffer()

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Riad-Anyssates-${date}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json({ error: 'Erreur génération Excel' }, { status: 500 })
  }
}
