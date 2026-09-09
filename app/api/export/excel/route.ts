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
const C_GOLD_BG   = 'FF92400E'   // coffre-fort
const C_DASH_BG   = 'FFF8F9FA'
const C_TITLE_BG  = 'FFEDE0D6'
const C_ALT_ROW   = 'FFFAFAFA'
 
// Couleurs d'onglet (tabColor)
const TAB_RED   = 'FF7F1D1D'   // fond de caisse — rouge foncé
const TAB_BLUE  = 'FF1F3864'   // banque — bleu foncé
const TAB_GOLD  = 'FFB8860B'   // coffre — doré/moutarde
const TAB_BLACK = 'FF000000'   // tableau de bord
 
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
    const [encaissements, depenses, fonds, coffre, settingsRows, baseFileRows] = await Promise.all([
      sql`SELECT * FROM entries WHERE type='cash' ORDER BY date ASC`,
      sql`SELECT * FROM entries WHERE type='cb' ORDER BY date ASC`,
      sql`SELECT * FROM fonds_entries ORDER BY date ASC`,
      sql`SELECT * FROM coffre_entries ORDER BY date ASC`,
      sql`SELECT key, value FROM settings WHERE key IN ('fond_caisse_mad', 'fond_caisse_eur', 'solde_bancaire_mad', 'solde_bancaire_eur')`,
      sql`SELECT value FROM settings WHERE key = 'excel_base_file'`,
    ])
 
    const settings: Record<string, number> = { fond_caisse_mad: 2000, fond_caisse_eur: 200, solde_bancaire_mad: 0, solde_bancaire_eur: 0 }
    for (const r of settingsRows) settings[r.key as string] = parseFloat(r.value as string) || 0
 
    // ── Pré-calcul global (pour le Tableau de bord, avant toute création d'onglet) ──
    const tdbEncTotal = encaissements.reduce((s, e) => s + Number(e.amount), 0)
    const tdbDepTotal = depenses.reduce((s, e) => s + Number(e.amount), 0)
 
    let tdbFondsIn = 0, tdbFondsOut = 0
    for (const e of fonds) {
      const amt = Number(e.amount)
      if ((e.direction as string) === 'in') tdbFondsIn += amt; else tdbFondsOut += amt
    }
 
    const tdbBankMoves = [...encaissements, ...depenses].filter(e => e.payment && e.payment !== 'Espèces')
    let tdbRunningMAD = settings.solde_bancaire_mad
    let tdbRunningEUR = settings.solde_bancaire_eur
    for (const e of tdbBankMoves) {
      const amt = Number(e.amount)
      const isIn = e.type === 'cash'
      const currency = (e.currency as string) || 'MAD'
      if (currency === 'EUR') tdbRunningEUR += isIn ? amt : -amt
      else tdbRunningMAD += isIn ? amt : -amt
    }
 
    let tdbCoffreIn = 0, tdbCoffreOut = 0
    for (const e of coffre) {
      const amt = Number(e.amount)
      if ((e.direction as string) === 'in') tdbCoffreIn += amt; else tdbCoffreOut += amt
    }
 
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Riad Anyssates'
    wb.created = new Date()
 
    // Load base Excel file if uploaded, preserving existing sheets
    if (baseFileRows.length > 0 && baseFileRows[0].value) {
      const buf = Buffer.from(baseFileRows[0].value as string, 'base64')
      await wb.xlsx.load(buf as any) // type cast needed for Node 22+ Buffer generics
      // Remove our managed sheets so we can regenerate them fresh
      const managed = [
        'Encaissements', 'Dépenses', 'Soldes', 'Banque', 'Fond de caisse', 'Coffre', 'Tableau de bord',
        'Dashboard Encaissements', 'Dashboard Dépenses', 'Dashboard Fond de caisse', 'Dashboard Banque', 'Dashboard Soldes', 'Dashboard Coffre',
        'DASHBOARD ENCAISSEMENTS', 'DASHBOARD DÉPENSES', 'FOND DE CAISSE', 'DASHBOARD FOND DE CAISSE', 'BANQUE', 'DASHBOARD BANQUE', 'COFFRE', 'DASHBOARD COFFRE', 'TABLEAU DE BORD',
      ]
      for (const name of managed) {
        const ws = wb.getWorksheet(name)
        if (ws) wb.removeWorksheet(ws.id)
      }
    }
 
    // ── Sheet: TABLEAU DE BORD (synthèse générale — 1er onglet) ───────────────
    const wsTdb = wb.addWorksheet('TABLEAU DE BORD', {
      views: [{ showGridLines: false }],
      properties: { tabColor: { argb: TAB_BLACK } },
    })
    ;(wsTdb as unknown as { orderNo: number }).orderNo = -1 // force en tout premier, même devant les onglets d'un fichier de base chargé (propriété interne non typée par exceljs)
    wsTdb.getColumn(1).width = 26
    wsTdb.getColumn(2).width = 30
    wsTdb.getColumn(3).width = 18
 
    wsTdb.mergeCells('A1:C1')
    const tdbTitle = wsTdb.getCell('A1')
    tdbTitle.value = '📊 TABLEAU DE BORD — Synthèse générale'
    tdbTitle.font = { bold: true, size: 14, name: 'Arial', color: { argb: 'FFFFFFFF' } }
    tdbTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TAB_BLACK } }
    tdbTitle.alignment = { horizontal: 'center', vertical: 'middle' }
    wsTdb.getRow(1).height = 32
 
    // KPI — vue d'ensemble Encaissements / Dépenses / Résultat net
    const tdbResultat = tdbEncTotal - tdbDepTotal
    const tdbKpis = [
      { label: 'Total encaissements', value: tdbEncTotal, color: 'FF2D6A4F' },
      { label: 'Total dépenses', value: tdbDepTotal, color: 'FF991B1B' },
      { label: 'Résultat net', value: tdbResultat, color: tdbResultat >= 0 ? 'FF2D6A4F' : 'FF991B1B' },
    ]
    let tdbKpiCol = 1
    for (const k of tdbKpis) {
      const kCell = wsTdb.getCell(3, tdbKpiCol)
      kCell.value = k.label
      kCell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
      kCell.alignment = { horizontal: 'left' }
      const vCell = wsTdb.getCell(4, tdbKpiCol)
      vCell.value = k.value
      vCell.numFmt = '#,##0.00'
      vCell.font = { bold: true, size: 16, name: 'Arial', color: { argb: k.color } }
      vCell.alignment = { horizontal: 'left' }
      vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_DASH_BG } }
      tdbKpiCol++
    }
    wsTdb.getRow(4).height = 28
 
    // Détail par section
    wsTdb.getCell('A6').value = 'DÉTAIL PAR SECTION'
    wsTdb.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
    hdr(wsTdb.getCell('A7'), 'Section', C_HEADER_BG)
    hdr(wsTdb.getCell('B7'), 'Indicateur', C_HEADER_BG)
    hdr(wsTdb.getCell('C7'), 'Montant', C_HEADER_BG)
 
    const tdbSectionRows: { section: string; label: string; value: number; color: string }[] = [
      { section: 'Fond de caisse', label: 'Entrées', value: tdbFondsIn, color: 'FF2D6A4F' },
      { section: 'Fond de caisse', label: 'Sorties', value: tdbFondsOut, color: 'FF991B1B' },
      { section: 'Banque', label: 'Solde net MAD', value: tdbRunningMAD, color: TAB_BLUE },
      { section: 'Banque', label: 'Solde net EUR', value: tdbRunningEUR, color: TAB_BLUE },
      { section: 'Coffre fort', label: 'Solde estimé', value: tdbCoffreIn - tdbCoffreOut, color: TAB_GOLD },
    ]
    let tdbRow = 8
    for (const r of tdbSectionRows) {
      const secColor = r.section === 'Fond de caisse' ? TAB_RED : r.section === 'Banque' ? TAB_BLUE : TAB_GOLD
      cell(wsTdb.getCell(tdbRow, 1), r.section, true, secColor)
      cell(wsTdb.getCell(tdbRow, 2), r.label)
      const vc = wsTdb.getCell(tdbRow, 3)
      vc.value = r.value
      vc.numFmt = '#,##0.00'
      vc.font = { name: 'Arial', size: 9, bold: true, color: { argb: r.color } }
      vc.alignment = { horizontal: 'right' }
      altRow(wsTdb.getRow(tdbRow), tdbRow)
      tdbRow++
    }
 
    const tdbNoteRow = wsTdb.getRow(tdbRow + 1)
    tdbNoteRow.getCell(1).value = `Fond de caisse — dotation initiale : ${settings.fond_caisse_mad} MAD + ${settings.fond_caisse_eur} EUR`
    tdbNoteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
 
    // ── Agrégats Encaissements (détail masqué, dashboard conservé) ────────────
    const encByCategory: Record<string, number> = {}
    const encByMonth: Record<string, number> = {}
    let encTotal = 0, encValidated = 0
 
    encaissements.forEach((e) => {
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const status = e.status as string
      encByCategory[e.category as string] = (encByCategory[e.category as string] || 0) + amt
      encByMonth[mois] = (encByMonth[mois] || 0) + amt
      encTotal += amt
      if (status === 'validated') encValidated += amt
    })
 
    // ── Dashboard Encaissements ───────────────────────────────────────────────
    const wsDashEnc = wb.addWorksheet('DASHBOARD ENCAISSEMENTS', { views: [{ showGridLines: false }] })
    addDashboard(wsDashEnc, 'Encaissements', encByCategory, encByMonth, [
      { label: 'Total', value: encTotal, color: 'FF2D6A4F' },
      { label: 'Validés', value: encValidated, color: 'FF3730A3' },
      { label: 'En attente', value: encTotal - encValidated, color: 'FFD97706' },
    ])
 
    // ── Agrégats Dépenses (détail masqué, dashboard conservé) ─────────────────
    const depByCategory: Record<string, number> = {}
    const depByMonth: Record<string, number> = {}
    let depTotal = 0, depValidated = 0
 
    depenses.forEach((e) => {
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const status = e.status as string
      depByCategory[e.category as string] = (depByCategory[e.category as string] || 0) + amt
      depByMonth[mois] = (depByMonth[mois] || 0) + amt
      depTotal += amt
      if (status === 'validated') depValidated += amt
    })
 
    // ── Dashboard Dépenses ────────────────────────────────────────────────────
    const wsDashDep = wb.addWorksheet('DASHBOARD DÉPENSES', { views: [{ showGridLines: false }] })
    addDashboard(wsDashDep, 'Dépenses', depByCategory, depByMonth, [
      { label: 'Total dépenses', value: depTotal, color: 'FF991B1B' },
      { label: 'Validées', value: depValidated, color: 'FF2D6A4F' },
      { label: 'En attente', value: depTotal - depValidated, color: 'FFD97706' },
    ])
 
    // ── Sheet: Fond de caisse ─────────────────────────────────────────────────
    const wsFonds = wb.addWorksheet('FOND DE CAISSE', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: TAB_RED } },
    })
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
    const wsDashFonds = wb.addWorksheet('DASHBOARD FOND DE CAISSE', { views: [{ showGridLines: false }] })
    addDashboard(wsDashFonds, 'Fond de caisse', fondsByCategory, fondsByMonth, [
      { label: `Dotation MAD`, value: settings.fond_caisse_mad, color: 'FF4338CA' },
      { label: 'Entrées', value: fondsIn, color: 'FF2D6A4F' },
      { label: 'Sorties', value: fondsOut, color: 'FF991B1B' },
    ])
    // Add solde note
    const soldeRow = wsDashFonds.getRow(5)
    soldeRow.getCell(1).value = `Solde = Dotation (${settings.fond_caisse_mad} MAD + ${settings.fond_caisse_eur} EUR) + Entrées − Sorties`
    soldeRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
 
    // ── Sheet: Banque (chèque, CB, virement — hors espèces) ──────────────────
    const wsSoldes = wb.addWorksheet('BANQUE', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: TAB_BLUE } },
    })
    wsSoldes.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'categorie', width: 22 },
      { key: 'description', width: 28 }, { key: 'mode', width: 14 }, { key: 'devise', width: 8 },
      { key: 'entrees', width: 14 }, { key: 'sorties', width: 14 }, { key: 'solde', width: 14 },
      { key: 'pointage', width: 12 }, { key: 'statut', width: 12 },
    ]
    const soldesHeaders = ['Date', 'Mois', 'Catégorie', 'Description', 'Mode paiement', 'Devise', 'Entrées', 'Sorties', 'Solde', 'Pointage', 'Statut']
    soldesHeaders.forEach((h, i) => hdr(wsSoldes.getCell(1, i + 1), h, C_BLUE_BG))
    wsSoldes.getRow(1).height = 22
 
    let runningMAD = settings.solde_bancaire_mad
    let runningEUR = settings.solde_bancaire_eur
 
    // Solde initial (une ligne par devise)
    for (const [dev, val] of [['MAD', runningMAD], ['EUR', runningEUR]] as const) {
      const row = wsSoldes.addRow({})
      row.getCell(3).value = 'SOLDE INITIAL'
      row.getCell(3).font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      row.getCell(6).value = dev
      row.getCell(6).alignment = { horizontal: 'center' }
      row.getCell(6).font = { name: 'Arial', size: 9, color: { argb: 'FF374151' } }
      const sc = row.getCell(9)
      sc.value = val; sc.numFmt = '#,##0.00'
      sc.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      sc.alignment = { horizontal: 'right' }
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } } })
    }
 
    const bankMoves = [...encaissements, ...depenses]
      .filter(e => e.payment && e.payment !== 'Espèces')
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
 
    const soldesByMode: Record<string, number> = {}
    const soldesByMonth: Record<string, number> = {}
    let entreesTotal = 0, sortiesTotal = 0
 
    bankMoves.forEach((e, idx) => {
      const row = wsSoldes.addRow({})
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const isIn = e.type === 'cash'
      const currency = (e.currency as string) || 'MAD'
      if (currency === 'EUR') runningEUR += isIn ? amt : -amt
      else runningMAD += isIn ? amt : -amt
 
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      cell(row.getCell(3), e.category)
      cell(row.getCell(4), e.description || '')
      cell(row.getCell(5), e.payment || '—')
      cell(row.getCell(6), currency, false, 'FF374151', 'center')
 
      if (isIn) {
        const ec = row.getCell(7)
        ec.value = amt; ec.numFmt = '#,##0.00'
        ec.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D6A4F' } }
        ec.alignment = { horizontal: 'right' }
      } else {
        const sc = row.getCell(8)
        sc.value = amt; sc.numFmt = '#,##0.00'
        sc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } }
        sc.alignment = { horizontal: 'right' }
      }
 
      const soldeC = row.getCell(9)
      soldeC.value = currency === 'EUR' ? runningEUR : runningMAD
      soldeC.numFmt = '#,##0.00'
      soldeC.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3730A3' } }
      soldeC.alignment = { horizontal: 'right' }
 
      // Pointage — case à cocher manuelle pour rapprocher avec le relevé bancaire
      const pointageC = row.getCell(10)
      pointageC.alignment = { horizontal: 'center' }
      pointageC.dataValidation = { type: 'list', allowBlank: true, formulae: ['"✓"'] }
      pointageC.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2D6A4F' } }
 
      const status = e.status as string
      const stc = row.getCell(11)
      stc.value = status === 'validated' ? 'Validé' : 'En attente'
      stc.font = { name: 'Arial', size: 9, bold: true, color: { argb: status === 'validated' ? 'FF2D6A4F' : 'FFD97706' } }
      stc.alignment = { horizontal: 'center' }
      altRow(row, idx + 4)
 
      const mode = (e.payment as string) || '—'
      soldesByMode[mode] = (soldesByMode[mode] || 0) + (isIn ? amt : -amt)
      soldesByMonth[mois] = (soldesByMonth[mois] || 0) + (isIn ? amt : -amt)
      if (isIn) entreesTotal += amt; else sortiesTotal += amt
    })
    wsSoldes.autoFilter = { from: 'A1', to: 'K1' }
 
    // Surligne en vert les lignes pointées
    wsSoldes.addConditionalFormatting({
      ref: `A2:K${wsSoldes.rowCount}`,
      rules: [{
        type: 'expression',
        formulae: ['$J2="✓"'],
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } } },
        priority: 1,
      }],
    })
 
    // ── Dashboard Banque ──────────────────────────────────────────────────────
    const wsDashSoldes = wb.addWorksheet('DASHBOARD BANQUE', { views: [{ showGridLines: false }] })
    addDashboard(wsDashSoldes, 'Banque', soldesByMode, soldesByMonth, [
      { label: 'Solde net MAD', value: runningMAD, color: 'FF3730A3' },
      { label: 'Solde net EUR', value: runningEUR, color: 'FF3730A3' },
      { label: 'Total entrées', value: entreesTotal, color: 'FF2D6A4F' },
      { label: 'Total sorties', value: sortiesTotal, color: 'FF991B1B' },
    ])
    const soldeNoteRow = wsDashSoldes.getRow(5)
    soldeNoteRow.getCell(1).value = `Solde = Solde initial (${settings.solde_bancaire_mad} MAD + ${settings.solde_bancaire_eur} EUR) + Entrées CB/Virement/Chèque − Sorties CB/Virement/Chèque`
    soldeNoteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
 
    // ── Sheet: Coffre (coffre-fort) ───────────────────────────────────────────
    const wsCoffre = wb.addWorksheet('COFFRE', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: TAB_GOLD } },
    })
    wsCoffre.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'sens', width: 12 },
      { key: 'categorie', width: 22 }, { key: 'employe', width: 18 },
      { key: 'montant', width: 12 }, { key: 'devise', width: 8 },
      { key: 'description', width: 28 }, { key: 'facture', width: 10 }, { key: 'statut', width: 12 },
    ]
    const coffreHeaders = ['Date', 'Mois', 'Sens', 'Catégorie', 'Par', 'Montant', 'Devise', 'Description', 'Facture', 'Statut']
    coffreHeaders.forEach((h, i) => hdr(wsCoffre.getCell(1, i + 1), h, C_GOLD_BG))
    wsCoffre.getRow(1).height = 22
 
    const coffreByCategory: Record<string, number> = {}
    const coffreByMonth: Record<string, number> = {}
    let coffreIn = 0, coffreOut = 0
 
    coffre.forEach((e, idx) => {
      const row = wsCoffre.addRow({})
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const isIn = (e.direction as string) === 'in'
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      const sc = row.getCell(3)
      sc.value = isIn ? '🔒 Dépôt' : '🔓 Retrait'
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
      const fc = row.getCell(9)
      const hasInvoice = !!(e.invoice_url as string)
      if (hasInvoice) {
        fc.value = { text: 'AF', hyperlink: e.invoice_url as string }
        fc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D6A4F' }, underline: true }
      } else {
        fc.value = 'SF'
        fc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF9CA3AF' } }
      }
      fc.alignment = { horizontal: 'center' }
      const stc = row.getCell(10)
      const status = e.status as string
      stc.value = status === 'validated' ? 'Validé' : 'En attente'
      stc.font = { name: 'Arial', size: 9, bold: true, color: { argb: status === 'validated' ? 'FF2D6A4F' : 'FFD97706' } }
      stc.alignment = { horizontal: 'center' }
      altRow(row, idx + 2)
      coffreByCategory[e.category as string] = (coffreByCategory[e.category as string] || 0) + amt
      coffreByMonth[mois] = (coffreByMonth[mois] || 0) + (isIn ? amt : -amt)
      if (isIn) coffreIn += amt; else coffreOut += amt
    })
    wsCoffre.autoFilter = { from: 'A1', to: 'J1' }
 
    // ── Dashboard Coffre ──────────────────────────────────────────────────────
    const wsDashCoffre = wb.addWorksheet('DASHBOARD COFFRE', { views: [{ showGridLines: false }] })
    addDashboard(wsDashCoffre, 'Coffre fort', coffreByCategory, coffreByMonth, [
      { label: 'Dépôts', value: coffreIn, color: 'FF2D6A4F' },
      { label: 'Retraits', value: coffreOut, color: 'FF991B1B' },
      { label: 'Solde estimé', value: coffreIn - coffreOut, color: C_GOLD_BG },
    ])
 
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
 
 
 

