import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { payableCategory } from '@/lib/payables'

export const dynamic = 'force-dynamic'

// Factures fournisseurs (sans le fichier joint, chargé à la demande)
export async function GET() {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`
      SELECT id, supplier, category, date, reference, description, amount, currency, due_date, filename,
        CASE WHEN file_data IS NULL THEN 0 ELSE 1 END AS has_file,
        status, paid_date, payment, entry_id, created_by
      FROM payables ORDER BY CASE WHEN status = 'todo' THEN 0 ELSE 1 END, COALESCE(due_date, date), id`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET payables error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const b = await req.json()
    const supplier = String(b.supplier || '').trim().slice(0, 120)
    const amount = Number(b.amount)
    if (!supplier || !b.date || !(amount > 0)) return NextResponse.json({ error: 'Fournisseur, date et montant requis' }, { status: 400 })
    const file = typeof b.file === 'string' && b.file.startsWith('data:') ? b.file : null
    const result = await sql`
      INSERT INTO payables (supplier, category, date, reference, description, amount, currency, due_date, file_data, filename, created_by)
      VALUES (${supplier}, ${b.category || payableCategory(supplier)}, ${b.date}, ${b.reference || null}, ${b.description || null},
        ${amount}, ${b.currency || 'MAD'}, ${b.due_date || null}, ${file}, ${file ? String(b.filename || 'facture').slice(0, 200) : null}, ${getManagerName()})
      RETURNING id`
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST payable error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
