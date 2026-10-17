import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { payableCategory } from '@/lib/payables'
import { linkBons } from '@/lib/payables-db'

export const dynamic = 'force-dynamic'

// Factures et bons fournisseurs (sans le fichier joint, chargé à la demande)
export async function GET() {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`
      SELECT id, COALESCE(kind, 'facture') AS kind, supplier, category, date, period, reference, description, notes, amount, currency, due_date, filename,
        CASE WHEN file_data IS NULL THEN 0 ELSE 1 END AS has_file,
        status, paid_date, payment, entry_id, invoice_id, created_by
      FROM payables ORDER BY CASE WHEN status = 'todo' THEN 0 ELSE 1 END, COALESCE(due_date, date), id`
    // Règlements (acomptes, solde) de chaque facture
    const pays = await sql`SELECT id, payable_id, date, amount, payment FROM payable_payments ORDER BY date, id`
    const byPayable = new Map<number, { id: number; date: string; amount: number; payment: string | null }[]>()
    for (const x of pays) {
      const list = byPayable.get(x.payable_id as number) ?? []
      list.push({ id: x.id as number, date: x.date as string, amount: Number(x.amount), payment: (x.payment as string) || null })
      byPayable.set(x.payable_id as number, list)
    }
    return NextResponse.json(rows.map(r => ({ ...r, payments: byPayable.get(r.id as number) ?? [] })))
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
    const kind = b.kind === 'bon' ? 'bon' : 'facture'
    const supplier = String(b.supplier || '').trim().slice(0, 120)
    const amount = Number(b.amount)
    if (!supplier || !b.date || !(amount > 0)) return NextResponse.json({ error: 'Fournisseur, date et montant requis' }, { status: 400 })
    const file = typeof b.file === 'string' && b.file.startsWith('data:') ? b.file : null
    const result = await sql`
      INSERT INTO payables (kind, supplier, category, date, period, reference, description, notes, amount, currency, due_date, file_data, filename, created_by)
      VALUES (${kind}, ${supplier}, ${b.category || payableCategory(supplier)}, ${b.date}, ${b.period || String(b.date).slice(0, 7)},
        ${b.reference || null}, ${b.description || null}, ${b.notes || null}, ${amount}, ${b.currency || 'MAD'}, ${kind === 'bon' ? null : b.due_date || null},
        ${file}, ${file ? String(b.filename || (kind === 'bon' ? 'bon' : 'facture')).slice(0, 200) : null}, ${getManagerName()})
      RETURNING id`
    const id = result[0].id as number
    if (kind === 'facture' && Array.isArray(b.bon_ids)) await linkBons(id, b.bon_ids)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST payable error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
