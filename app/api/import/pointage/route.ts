import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import ExcelJS from 'exceljs'
 
export const dynamic = 'force-dynamic'
 
// GET — historique des imports de pointage (fichiers Excel réimportés)
export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const rows = await sql`SELECT id, filename, imported_count, created_at FROM excel_pointage_imports ORDER BY created_at DESC, id DESC`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET import pointage error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
// POST — reçoit le fichier Excel (onglet BANQUE) pointé par l'utilisateur,
// relit la colonne "Pointage" (et la colonne ID masquée) pour mettre à jour
// entries.pointed en base, puis archive le fichier tel quel.
export async function POST(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Format .xlsx requis' }, { status: 400 })
    }
 
    const bytes = await file.arrayBuffer()
 
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes as any) // type cast nécessaire pour Node 22+ (Buffer generics)
 
    const wsBanque = wb.getWorksheet('BANQUE')
    if (!wsBanque) {
      return NextResponse.json({ error: "Onglet BANQUE introuvable dans ce fichier — vérifie que c'est bien un export généré par l'application" }, { status: 400 })
    }
 
    // Ligne 1 = en-têtes, ligne 2 = SOLDE INITIAL, mouvements à partir de la ligne 3
    const updates: { id: number; pointed: boolean }[] = []
    for (let rowNum = 3; rowNum <= wsBanque.rowCount; rowNum++) {
      const row = wsBanque.getRow(rowNum)
      const idRaw = row.getCell(14).value
      const id = typeof idRaw === 'number' ? idRaw : parseInt(String(idRaw ?? ''), 10)
      if (!Number.isFinite(id) || id <= 0) continue // ligne vide ou colonne ID manquante (fichier non conforme)
 
      const pointageRaw = row.getCell(11).value
      const pointed = !!(pointageRaw && String(pointageRaw).trim())
      updates.push({ id, pointed })
    }
 
    if (updates.length === 0) {
      return NextResponse.json({ error: "Aucune ligne exploitable trouvée — la colonne ID (masquée) est peut-être manquante. Réexporte un fichier récent depuis l'application avant de le pointer." }, { status: 400 })
    }
 
    for (const u of updates) {
      await sql`UPDATE entries SET pointed = ${u.pointed ? 1 : 0} WHERE id = ${u.id}`
    }
 
    const base64 = Buffer.from(bytes).toString('base64')
    const importedCount = updates.filter(u => u.pointed).length
    const result = await sql`
      INSERT INTO excel_pointage_imports (filename, file_base64, imported_count)
      VALUES (${file.name}, ${base64}, ${importedCount})
      RETURNING id
    `
 
    return NextResponse.json({
      ok: true,
      updated: updates.length,
      pointed: importedCount,
      archiveId: result[0].id,
    })
  } catch (error) {
    console.error('POST import pointage error:', error)
    return NextResponse.json({ error: 'Erreur lors du traitement du fichier' }, { status: 500 })
  }
}
 
