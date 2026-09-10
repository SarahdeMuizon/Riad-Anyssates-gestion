import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import ExcelJS from 'exceljs'
 
export const dynamic = 'force-dynamic'
 
// Colors
const C_HEADER_BG = 'FF8B4513'   // terracotta
const C_HEADER_FG = 'FFFFFFFF'
const C_BLUE_BG   = 'FF3730A3'
const C_PURPLE_BG = 'FF6366F1'
const C_GOLD_BG   = 'FF92400E'   // coffre-fort
const C_ALT_ROW   = 'FFFAFAFA'
 
// Couleurs d'onglet (tabColor)
const TAB_RED   = 'FF7F1D1D'   // fond de caisse — rouge foncé
const TAB_BLUE  = 'FF1F3864'   // banque — bleu foncé
const TAB_GOLD  = 'FFB8860B'   // coffre — doré/moutarde
const TAB_BLACK = 'FF000000'   // tableau de bord
 
const MONTHS_FR = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE']
 
// Doit rester synchronisé avec DEPENSES_CATEGORIES dans app/manager/page.tsx
const DEPENSES_CATEGORIES_TDB = ['Alimentation/Courses', 'Fournitures & bureautique', 'Entretien & maintenance', 'Transport', 'Restauration', 'Pharmacie/Hygiène', 'Décoration & fleurs', 'Autre']
 
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
 
// Carte indicateur (KPI) : libellé sur 2 colonnes fusionnées, valeur (formule) juste en dessous
function kpiCard(ws: ExcelJS.Worksheet, startCol: number, labelRow: number, label: string, formula: string, color: string) {
  const endCol = startCol + 1
  ws.mergeCells(labelRow, startCol, labelRow, endCol)
  const lc = ws.getCell(labelRow, startCol)
  lc.value = label
  lc.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
  lc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  ws.mergeCells(labelRow + 1, startCol, labelRow + 1, endCol)
  const vc = ws.getCell(labelRow + 1, startCol)
  vc.value = { formula }
  vc.numFmt = '#,##0.00'
  vc.font = { bold: true, size: 15, name: 'Arial', color: { argb: color } }
  vc.alignment = { horizontal: 'center', vertical: 'middle' }
  vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
  ws.getRow(labelRow).height = 18
  ws.getRow(labelRow + 1).height = 26
}
 
// Bandeau de titre de section, sur toute la largeur du tableau
function sectionTitle(ws: ExcelJS.Worksheet, row: number, text: string, lastCol: number) {
  ws.mergeCells(row, 1, row, lastCol)
  const c = ws.getCell(row, 1)
  c.value = text
  c.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FF1F2937' } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
  c.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(row).height = 20
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
 
    // ── Totaux Encaissements / Dépenses (le détail par transaction ne vit que
    //    dans les onglets bruts — il n'y a plus de dashboards par catégorie) ──
    let encTotal = 0
    encaissements.forEach((e) => { encTotal += Number(e.amount) })
 
    let depTotal = 0
    const depByCategoryTotal: Record<string, number> = {}
    depenses.forEach((e) => {
      const amt = Number(e.amount)
      depTotal += amt
      const cat = (e.category as string) || 'Autre'
      depByCategoryTotal[cat] = (depByCategoryTotal[cat] || 0) + amt
    })
 
    const tdbResultat = encTotal - depTotal // utilisé uniquement pour la couleur (vert/rouge)
 
    // Mouvements bancaires (chèque, CB, virement — hors espèces, MAD uniquement)
    // Calculé ici (avant la construction de l'onglet BANQUE) pour connaître le
    // nombre de lignes et pouvoir y faire référence depuis le TABLEAU DE BORD.
    const bankMoves = [...encaissements, ...depenses]
      .filter(e => e.payment && e.payment !== 'Espèces' && (!e.currency || e.currency === 'MAD'))
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
 
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
 
    // ── Sheet: TABLEAU DE BORD (synthèse générale — 1er et unique onglet de synthèse) ─
    const year = new Date().getFullYear()
    const lastFondsRow = 2 + fonds.length // ligne 1 = en-têtes, ligne 2 = dotation, puis les mouvements
 
    const wsTdb = wb.addWorksheet('TABLEAU DE BORD', {
      views: [{ showGridLines: false }],
      properties: { tabColor: { argb: TAB_BLACK } },
    })
    ;(wsTdb as unknown as { orderNo: number }).orderNo = -1 // force en tout premier, même devant les onglets d'un fichier de base chargé (propriété interne non typée par exceljs)
    wsTdb.getColumn(1).width = 26
    for (let c = 2; c <= 8; c++) wsTdb.getColumn(c).width = 16
    wsTdb.getColumn(9).width = 13
 
    // Bannière + date de mise à jour
    wsTdb.mergeCells(1, 1, 1, 9)
    const tdbTitle = wsTdb.getCell('A1')
    tdbTitle.value = `🏮 RIAD ANYSSATES — TABLEAU DE BORD COMPTABLE ${year}`
    tdbTitle.font = { bold: true, size: 14, name: 'Arial', color: { argb: 'FFFFFFFF' } }
    tdbTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TAB_BLACK } }
    tdbTitle.alignment = { horizontal: 'center', vertical: 'middle' }
    wsTdb.getRow(1).height = 32
 
    wsTdb.mergeCells(2, 1, 2, 9)
    const tdbSubtitle = wsTdb.getCell('A2')
    tdbSubtitle.value = `Mis à jour le ${new Date().toLocaleDateString('fr-FR')}`
    tdbSubtitle.font = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF6B7280' } }
    tdbSubtitle.alignment = { horizontal: 'center', vertical: 'middle' }
 
    // ── 4 indicateurs de solde (formules auditables, pointent vers les onglets bruts) ──
    // BANQUE et COFFRE affichent désormais le plus récent en haut (ligne 2) :
    // c'est donc là que se trouve le solde courant. FOND DE CAISSE reste trié
    // du plus ancien au plus récent, donc son solde courant reste en bas.
    kpiCard(wsTdb, 1, 4, 'COFFRE — SOLDE DHS', `'COFFRE'!H2`, C_GOLD_BG)
    kpiCard(wsTdb, 3, 4, 'COFFRE — SOLDE €', `'COFFRE'!L2`, C_GOLD_BG)
    kpiCard(wsTdb, 5, 4, 'BANQUE — SOLDE MAD', `'BANQUE'!J2`, TAB_BLUE)
    kpiCard(wsTdb, 7, 4, 'FOND DE CAISSE — SOLDE DHS', `'FOND DE CAISSE'!J${lastFondsRow}`, TAB_RED)
 
    // ── Synthèse par mois (Entrées / Charges / Résultat) ──────────────────────
    sectionTitle(wsTdb, 7, `SYNTHÈSE PAR MOIS (DHS) — ${year}`, 9)
    const synHeaders = ['MOIS', 'ENTRÉES COFFRE', 'ENTRÉES BANQUE', 'TOTAL ENTRÉES', 'CHARGES COFFRE', 'CHARGES BANQUE', 'TOTAL CHARGES', 'RÉSULTAT', '% MARGE']
    synHeaders.forEach((h, i) => hdr(wsTdb.getCell(8, i + 1), h, C_HEADER_BG))
    wsTdb.getRow(8).height = 26
 
    const synFirstRow = 9
    MONTHS_FR.forEach((mois, i) => {
      const row = synFirstRow + i
      const moisLabel = `${mois} ${year}`
      cell(wsTdb.getCell(row, 1), moisLabel, true)
      const bEnt = wsTdb.getCell(row, 2); bEnt.value = { formula: `SUMIF('COFFRE'!B:B,"${moisLabel}",'COFFRE'!G:G)` }
      const cEnt = wsTdb.getCell(row, 3); cEnt.value = { formula: `SUMIF('BANQUE'!B:B,"${moisLabel}",'BANQUE'!I:I)` }
      const dTot = wsTdb.getCell(row, 4); dTot.value = { formula: `B${row}+C${row}` }
      const eChg = wsTdb.getCell(row, 5); eChg.value = { formula: `SUMIF('COFFRE'!B:B,"${moisLabel}",'COFFRE'!F:F)` }
      const fChg = wsTdb.getCell(row, 6); fChg.value = { formula: `SUMIF('BANQUE'!B:B,"${moisLabel}",'BANQUE'!H:H)` }
      const gTot = wsTdb.getCell(row, 7); gTot.value = { formula: `E${row}+F${row}` }
      const hRes = wsTdb.getCell(row, 8); hRes.value = { formula: `D${row}-G${row}` }
      const iMarge = wsTdb.getCell(row, 9); iMarge.value = { formula: `IFERROR(H${row}/D${row},0)` }
      for (const col of [2, 3, 4, 5, 6, 7, 8]) { const c = wsTdb.getCell(row, col); c.numFmt = '#,##0.00'; c.font = { name: 'Arial', size: 9 }; c.alignment = { horizontal: 'right' } }
      iMarge.numFmt = '0.0%'; iMarge.font = { name: 'Arial', size: 9 }; iMarge.alignment = { horizontal: 'right' }
      wsTdb.getCell(row, 8).font = { name: 'Arial', size: 9, bold: true }
      altRow(wsTdb.getRow(row), row)
    })
    const synTotalRow = synFirstRow + 12
    cell(wsTdb.getCell(synTotalRow, 1), `TOTAL ${year}`, true)
    for (const col of [2, 3, 4, 5, 6, 7, 8]) {
      const colLetter = String.fromCharCode(64 + col)
      const c = wsTdb.getCell(synTotalRow, col)
      c.value = { formula: `SUM(${colLetter}${synFirstRow}:${colLetter}${synTotalRow - 1})` }
      c.numFmt = '#,##0.00'; c.font = { name: 'Arial', size: 9, bold: true }; c.alignment = { horizontal: 'right' }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
    }
    const synTotalMarge = wsTdb.getCell(synTotalRow, 9)
    synTotalMarge.value = { formula: `IFERROR(H${synTotalRow}/D${synTotalRow},0)` }
    synTotalMarge.numFmt = '0.0%'; synTotalMarge.font = { name: 'Arial', size: 9, bold: true }; synTotalMarge.alignment = { horizontal: 'right' }
    synTotalMarge.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
    wsTdb.getCell(synTotalRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
 
    // ── Top dépenses par catégorie (cumul année) ──────────────────────────────
    // Sourcé directement depuis les Dépenses de l'appli (toutes méthodes de
    // paiement confondues) : valeurs calculées (pas de formule Excel possible,
    // il n'y a plus d'onglet de détail transaction par transaction dans cet export).
    const topDepRow0 = synTotalRow + 2
    sectionTitle(wsTdb, topDepRow0, `TOP DÉPENSES PAR CATÉGORIE (Cumul ${year})`, 9)
    hdr(wsTdb.getCell(topDepRow0 + 1, 1), 'CATÉGORIE', C_HEADER_BG)
    hdr(wsTdb.getCell(topDepRow0 + 1, 2), 'MONTANT (DHS)', C_HEADER_BG)
    hdr(wsTdb.getCell(topDepRow0 + 1, 3), '% DU TOTAL', C_HEADER_BG)
    const sortedDepCats = [...DEPENSES_CATEGORIES_TDB].sort((a, b) => (depByCategoryTotal[b] || 0) - (depByCategoryTotal[a] || 0))
    const topDepFirstRow = topDepRow0 + 2
    sortedDepCats.forEach((catName, i) => {
      const row = topDepFirstRow + i
      cell(wsTdb.getCell(row, 1), catName)
      const mCell = wsTdb.getCell(row, 2)
      mCell.value = depByCategoryTotal[catName] || 0
      mCell.numFmt = '#,##0.00'; mCell.font = { name: 'Arial', size: 9, bold: true }; mCell.alignment = { horizontal: 'right' }
      const pCell = wsTdb.getCell(row, 3)
      pCell.value = { formula: `IFERROR(B${row}/SUM($B$${topDepFirstRow}:$B$${topDepFirstRow + sortedDepCats.length - 1}),0)` }
      pCell.numFmt = '0.0%'; pCell.font = { name: 'Arial', size: 9 }; pCell.alignment = { horizontal: 'right' }
      altRow(wsTdb.getRow(row), row)
    })
    const topDepTotalRow = topDepFirstRow + sortedDepCats.length
    cell(wsTdb.getCell(topDepTotalRow, 1), 'TOTAL', true)
    const topDepTotalCell = wsTdb.getCell(topDepTotalRow, 2)
    topDepTotalCell.value = { formula: `SUM(B${topDepFirstRow}:B${topDepTotalRow - 1})` }
    topDepTotalCell.numFmt = '#,##0.00'; topDepTotalCell.font = { name: 'Arial', size: 9, bold: true }; topDepTotalCell.alignment = { horizontal: 'right' }
    wsTdb.getCell(topDepTotalRow, 3).value = '100%'
    for (const col of [1, 2, 3]) wsTdb.getCell(topDepTotalRow, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
    const topDepNoteRow = wsTdb.getRow(topDepTotalRow + 1)
    topDepNoteRow.getCell(1).value = 'Calculé à partir des dépenses enregistrées dans l\'application, toutes méthodes de paiement confondues (valeurs figées, pas des formules Excel).'
    topDepNoteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
 
    // ── Dépenses sans facture (SF) — Coffre uniquement ────────────────────────
    const sfRow0 = topDepTotalRow + 3
    sectionTitle(wsTdb, sfRow0, '⚠️ DÉPENSES SANS FACTURE (SF) — Non justifiées · Coffre uniquement', 9)
    hdr(wsTdb.getCell(sfRow0 + 1, 1), 'MOIS', C_HEADER_BG)
    hdr(wsTdb.getCell(sfRow0 + 1, 2), 'TOTAL SF (DHS)', C_HEADER_BG)
    hdr(wsTdb.getCell(sfRow0 + 1, 3), 'TOTAL DÉPENSES COFFRE (DHS)', C_HEADER_BG)
    hdr(wsTdb.getCell(sfRow0 + 1, 4), '% NON JUSTIFIÉ', C_HEADER_BG)
    const sfFirstRow = sfRow0 + 2
    MONTHS_FR.forEach((mois, i) => {
      const row = sfFirstRow + i
      const moisLabel = `${mois} ${year}`
      cell(wsTdb.getCell(row, 1), moisLabel, true)
      const bSf = wsTdb.getCell(row, 2); bSf.value = { formula: `SUMIFS('COFFRE'!F:F,'COFFRE'!I:I,"SF",'COFFRE'!B:B,"${moisLabel}")` }
      const cTot = wsTdb.getCell(row, 3); cTot.value = { formula: `SUMIF('COFFRE'!B:B,"${moisLabel}",'COFFRE'!F:F)` }
      const dPct = wsTdb.getCell(row, 4); dPct.value = { formula: `IFERROR(B${row}/C${row},0)` }
      bSf.numFmt = '#,##0.00'; bSf.font = { name: 'Arial', size: 9 }; bSf.alignment = { horizontal: 'right' }
      cTot.numFmt = '#,##0.00'; cTot.font = { name: 'Arial', size: 9 }; cTot.alignment = { horizontal: 'right' }
      dPct.numFmt = '0.0%'; dPct.font = { name: 'Arial', size: 9 }; dPct.alignment = { horizontal: 'right' }
      altRow(wsTdb.getRow(row), row)
    })
    const sfTotalRow = sfFirstRow + 12
    cell(wsTdb.getCell(sfTotalRow, 1), `TOTAL ${year}`, true)
    const sfTotB = wsTdb.getCell(sfTotalRow, 2); sfTotB.value = { formula: `SUM(B${sfFirstRow}:B${sfTotalRow - 1})` }
    const sfTotC = wsTdb.getCell(sfTotalRow, 3); sfTotC.value = { formula: `SUM(C${sfFirstRow}:C${sfTotalRow - 1})` }
    const sfTotD = wsTdb.getCell(sfTotalRow, 4); sfTotD.value = { formula: `IFERROR(B${sfTotalRow}/C${sfTotalRow},0)` }
    sfTotB.numFmt = '#,##0.00'; sfTotB.font = { name: 'Arial', size: 9, bold: true }; sfTotB.alignment = { horizontal: 'right' }
    sfTotC.numFmt = '#,##0.00'; sfTotC.font = { name: 'Arial', size: 9, bold: true }; sfTotC.alignment = { horizontal: 'right' }
    sfTotD.numFmt = '0.0%'; sfTotD.font = { name: 'Arial', size: 9, bold: true }; sfTotD.alignment = { horizontal: 'right' }
    for (const col of [1, 2, 3, 4]) wsTdb.getCell(sfTotalRow, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE0D6' } }
 
    // ── Fond de caisse — suivi des liquidités physiques ───────────────────────
    const fdcRow0 = sfTotalRow + 2
    sectionTitle(wsTdb, fdcRow0, '💰 FOND DE CAISSE — Suivi des liquidités physiques', 9)
    const fdcRows: { label: string; value?: number; formula?: string }[] = [
      { label: 'Seuil minimum fond de caisse (DHS)', value: settings.fond_caisse_mad },
      { label: 'Solde actuel fond de caisse (DHS)', formula: `'FOND DE CAISSE'!J${lastFondsRow}` },
      { label: 'Alerte', formula: `IF(B${fdcRow0 + 2}<B${fdcRow0 + 1},"⚠️ SOLDE INFÉRIEUR AU SEUIL — Réapprovisionner","✅ Solde suffisant")` },
      { label: 'Écart au seuil (DHS)', formula: `B${fdcRow0 + 2}-B${fdcRow0 + 1}` },
    ]
    fdcRows.forEach((r, i) => {
      const row = fdcRow0 + 1 + i
      cell(wsTdb.getCell(row, 1), r.label, true)
      const vC = wsTdb.getCell(row, 2)
      vC.value = r.formula ? { formula: r.formula } : (r.value ?? 0)
      if (r.label !== 'Alerte') { vC.numFmt = '#,##0.00'; vC.alignment = { horizontal: 'right' } }
      vC.font = { name: 'Arial', size: 9, bold: true, color: { argb: TAB_RED } }
      altRow(wsTdb.getRow(row), row)
    })
 
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
      { key: 'solde', width: 14 },
    ]
    const fondsHeaders = ['Date', 'Mois', 'Sens', 'Catégorie', 'Employé', 'Montant', 'Devise', 'Description', 'Statut', 'Solde DHS']
    fondsHeaders.forEach((h, i) => hdr(wsFonds.getCell(1, i + 1), h, C_PURPLE_BG))
    wsFonds.getRow(1).height = 22
 
    // Dotation row — J2 sert de point de départ au solde cumulé DHS ci-dessous
    // (la dotation en EUR reste indicative en colonne H, pas de solde € suivi ici)
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
    const dotSoldeC = dotRow.getCell(10)
    dotSoldeC.value = { formula: 'F2' }
    dotSoldeC.numFmt = '#,##0.00'
    dotSoldeC.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF4338CA' } }
    dotSoldeC.alignment = { horizontal: 'right' }
 
    fonds.forEach((e, idx) => {
      const row = wsFonds.addRow({})
      const rowNum = row.number
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
      // Solde DHS cumulé — formule Excel (auditable) : ne compte que les
      // mouvements en devise MAD (une ligne en EUR laisse le solde DHS inchangé)
      const soldeC = row.getCell(10)
      soldeC.value = { formula: `J${rowNum - 1}+IF(G${rowNum}="MAD",F${rowNum},0)` }
      soldeC.numFmt = '#,##0.00'
      soldeC.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4338CA' } }
      soldeC.alignment = { horizontal: 'right' }
      altRow(row, idx + 3)
    })
    wsFonds.autoFilter = { from: 'A1', to: 'J1' }
 
    // ── Sheet: Banque (chèque, CB, virement — hors espèces) ──────────────────
    const wsSoldes = wb.addWorksheet('BANQUE', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: TAB_BLUE } },
    })
    wsSoldes.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'employe', width: 16 },
      { key: 'mode', width: 14 }, { key: 'facture', width: 14 }, { key: 'categorie', width: 20 },
      { key: 'libelle', width: 30 }, { key: 'sortie', width: 14 }, { key: 'entree', width: 14 },
      { key: 'theorique', width: 14 }, { key: 'pointage', width: 10 }, { key: 'reel', width: 14 },
      { key: 'ecart', width: 10 },
      { key: 'id', width: 8, hidden: true }, // colonne technique (masquée) : sert à ré-associer la ligne au bon mouvement lors d'un ré-import du pointage
    ]
    const soldesHeaders = ['Date', 'Mois', 'Employé', 'Mode', 'N° Facture', 'Catégorie', 'Libellé', 'Sortie DHS', 'Entrée DHS', 'Théorique', 'Pointé', 'Réel', 'Écart']
    soldesHeaders.forEach((h, i) => hdr(wsSoldes.getCell(1, i + 1), h, C_BLUE_BG))
    wsSoldes.getRow(1).height = 22
 
    // Les mouvements sont affichés du plus récent au plus ancien (ligne 2 = le
    // plus récent). La ligne SOLDE INITIAL, chronologiquement la plus ancienne,
    // est donc placée tout en bas ; les formules cumulées (Théorique/Réel)
    // pointent vers la ligne du DESSOUS (chronologiquement antérieure) plutôt
    // que celle du dessus comme lorsque le tri était croissant.
    const bankLastRow = 2 + bankMoves.length // dernière ligne = SOLDE INITIAL
    const bankMovesDesc = [...bankMoves].reverse()
 
    bankMovesDesc.forEach((e, idx) => {
      const row = wsSoldes.addRow({})
      const rowNum = row.number
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const isIn = e.type === 'cash'
 
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      cell(row.getCell(3), e.employee_name)
      cell(row.getCell(4), e.payment || '—')
      cell(row.getCell(5), e.reference || '')
      cell(row.getCell(6), e.category)
      cell(row.getCell(7), e.description || '')
 
      if (isIn) {
        const ec = row.getCell(9)
        ec.value = amt; ec.numFmt = '#,##0.00'
        ec.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D6A4F' } }
        ec.alignment = { horizontal: 'right' }
      } else {
        const sc = row.getCell(8)
        sc.value = amt; sc.numFmt = '#,##0.00'
        sc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } }
        sc.alignment = { horizontal: 'right' }
      }
 
      // Théorique — formule Excel (auditable) : théorique de la ligne du dessous
      // (chronologiquement antérieure) + Entrée de cette ligne − Sortie de cette ligne
      const thC = row.getCell(10)
      thC.value = { formula: `J${rowNum + 1}+I${rowNum}-H${rowNum}` }
      thC.numFmt = '#,##0.00'
      thC.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3730A3' } }
      thC.alignment = { horizontal: 'right' }
 
      // Pointé — case à cocher manuelle pour rapprocher avec le relevé bancaire.
      // Pré-cochée si ce mouvement est déjà marqué pointé en base (import précédent).
      const ptC = row.getCell(11)
      ptC.value = e.pointed ? '✓' : undefined
      ptC.alignment = { horizontal: 'center' }
      ptC.dataValidation = { type: 'list', allowBlank: true, formulae: ['"✓"'] }
      ptC.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2D6A4F' } }
 
      // Réel — solde cumulé (vers le bas) ne comptant que les lignes pointées
      const reC = row.getCell(12)
      reC.value = { formula: `L${rowNum + 1}+IF(K${rowNum}="✓",I${rowNum}-H${rowNum},0)` }
      reC.numFmt = '#,##0.00'
      reC.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3730A3' } }
      reC.alignment = { horizontal: 'right' }
 
      // Écart — différence entre le Réel (pointé) et le Théorique
      const ecC = row.getCell(13)
      ecC.value = { formula: `IF(L${rowNum}="","",L${rowNum}-J${rowNum})` }
      ecC.numFmt = '#,##0.00'
      ecC.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }
      ecC.alignment = { horizontal: 'right' }
 
      // ID technique (colonne masquée) — utilisé pour ré-associer la ligne au
      // bon mouvement en base lors d'un ré-import du fichier pointé
      cell(row.getCell(14), e.id)
 
      altRow(row, idx + 2)
    })
 
    // Solde initial — tout en bas (la ligne la plus ancienne chronologiquement).
    // Sert de base aux formules cumulées ci-dessus (I-H, sans référence à une
    // autre ligne puisque c'est le point de départ de l'historique).
    {
      const row = wsSoldes.addRow({})
      const rowNum = row.number // = bankLastRow
      row.getCell(7).value = 'SOLDE INITIAL'
      row.getCell(7).font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      const ec = row.getCell(9)
      ec.value = settings.solde_bancaire_mad; ec.numFmt = '#,##0.00'
      ec.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      ec.alignment = { horizontal: 'right' }
      const thC = row.getCell(10)
      thC.value = { formula: `I${rowNum}-H${rowNum}` }
      thC.numFmt = '#,##0.00'
      thC.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      thC.alignment = { horizontal: 'right' }
      const ptC = row.getCell(11)
      ptC.value = '✓'
      ptC.alignment = { horizontal: 'center' }
      ptC.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2D6A4F' } }
      const reC = row.getCell(12)
      reC.value = { formula: `IF(K${rowNum}="✓",I${rowNum}-H${rowNum},0)` }
      reC.numFmt = '#,##0.00'
      reC.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF3730A3' } }
      reC.alignment = { horizontal: 'right' }
      const ecC = row.getCell(13)
      ecC.value = { formula: `IF(L${rowNum}="","",L${rowNum}-J${rowNum})` }
      ecC.numFmt = '#,##0.00'
      ecC.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }
      ecC.alignment = { horizontal: 'right' }
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } } })
    }
    wsSoldes.autoFilter = { from: 'A1', to: 'M1' }
 
    // Surligne en vert les lignes pointées
    wsSoldes.addConditionalFormatting({
      ref: `A2:M${wsSoldes.rowCount}`,
      rules: [{
        type: 'expression',
        formulae: ['$K2="✓"'],
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } } },
        priority: 1,
      }],
    })
 
    // ── Sheet: Coffre (coffre-fort) ───────────────────────────────────────────
    const wsCoffre = wb.addWorksheet('COFFRE', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: TAB_GOLD } },
    })
    wsCoffre.columns = [
      { key: 'date', width: 12 }, { key: 'mois', width: 16 }, { key: 'employe', width: 16 },
      { key: 'categorie', width: 20 }, { key: 'libelle', width: 30 },
      { key: 'sortieDhs', width: 14 }, { key: 'entreeDhs', width: 14 }, { key: 'soldeDhs', width: 14 },
      { key: 'afsf', width: 10 },
      { key: 'sortieEur', width: 14 }, { key: 'entreeEur', width: 14 }, { key: 'soldeEur', width: 14 },
    ]
    const coffreHeaders = ['Date', 'Mois', 'Employé', 'Catégorie', 'Libellé', 'Sortie DHS', 'Entrée DHS', 'Solde DHS', 'AF/SF', 'Sortie €', 'Entrée €', 'Solde €']
    coffreHeaders.forEach((h, i) => hdr(wsCoffre.getCell(1, i + 1), h, C_GOLD_BG))
    wsCoffre.getRow(1).height = 22
 
    // Affiché du plus récent au plus ancien (ligne 2 = le plus récent) : la
    // ligne la plus ancienne (dernière du tableau) sert de cas de base pour le
    // solde cumulé, et chaque autre ligne pointe vers celle du DESSOUS
    // (chronologiquement antérieure) plutôt que celle du dessus.
    const coffreLastRow = 1 + coffre.length
    const coffreDesc = [...coffre].reverse()
 
    coffreDesc.forEach((e, idx) => {
      const row = wsCoffre.addRow({})
      const rowNum = row.number
      const isOldest = rowNum === coffreLastRow
      const dateStr = (e.date as string).slice(0, 10)
      const mois = formatMois(dateStr)
      const amt = Number(e.amount)
      const isIn = (e.direction as string) === 'in'
      const isEur = (e.currency as string) === 'EUR'
 
      cell(row.getCell(1), dateStr)
      cell(row.getCell(2), mois)
      cell(row.getCell(3), e.employee_name)
      cell(row.getCell(4), e.category)
      cell(row.getCell(5), e.description || '')
 
      const amtCol = isEur ? (isIn ? 11 : 10) : (isIn ? 7 : 6)
      const ac = row.getCell(amtCol)
      ac.value = amt; ac.numFmt = '#,##0.00'
      ac.font = { name: 'Arial', size: 9, bold: true, color: { argb: isIn ? 'FF2D6A4F' : 'FF991B1B' } }
      ac.alignment = { horizontal: 'right' }
 
      // Solde DHS cumulé — formule Excel (auditable)
      const soldeDhsC = row.getCell(8)
      soldeDhsC.value = { formula: isOldest ? `G${rowNum}-F${rowNum}` : `H${rowNum + 1}+G${rowNum}-F${rowNum}` }
      soldeDhsC.numFmt = '#,##0.00'
      soldeDhsC.font = { name: 'Arial', size: 9, bold: true, color: { argb: C_GOLD_BG } }
      soldeDhsC.alignment = { horizontal: 'right' }
 
      // AF/SF — justificatif joint (Avec Facture) ou non (Sans Facture)
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
 
      // Solde € cumulé — formule Excel (auditable)
      const soldeEurC = row.getCell(12)
      soldeEurC.value = { formula: isOldest ? `K${rowNum}-J${rowNum}` : `L${rowNum + 1}+K${rowNum}-J${rowNum}` }
      soldeEurC.numFmt = '#,##0.00'
      soldeEurC.font = { name: 'Arial', size: 9, bold: true, color: { argb: C_GOLD_BG } }
      soldeEurC.alignment = { horizontal: 'right' }
 
      altRow(row, idx + 2)
    })
    wsCoffre.autoFilter = { from: 'A1', to: 'L1' }
 
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
 
