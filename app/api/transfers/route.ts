import { NextRequest, NextResponse } from 'next/server'
import { sqlBatch, ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TRANSFER_CATEGORY = 'Transfert coffre ↔ caisse'

// POST /api/transfers  { direction: 'coffre_to_fonds' | 'fonds_to_coffre', date, amount, currency, description? }
// Crée les deux mouvements liés (sortie d'un côté, entrée de l'autre) avec le même transfer_id.
export async function POST(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    await ensureDb()

    const { direction, date, amount, currency, description } = await req.json()
    const amt = Number(amount)
    if (!date || !amt || amt <= 0) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    if (direction !== 'coffre_to_fonds' && direction !== 'fonds_to_coffre') {
      return NextResponse.json({ error: 'Sens invalide' }, { status: 400 })
    }

    const cur = currency === 'EUR' ? 'EUR' : 'MAD'
    const who = getManagerName()
    const transferId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const label = direction === 'coffre_to_fonds' ? 'Coffre → Fond de caisse' : 'Fond de caisse → Coffre'
    const desc = description ? `${label} — ${description}` : label
    const fondsDir = direction === 'coffre_to_fonds' ? 'in' : 'out'
    const coffreDir = direction === 'coffre_to_fonds' ? 'out' : 'in'

    await sqlBatch([
      {
        sql: `INSERT INTO fonds_entries (employee_name, direction, date, amount, currency, category, description, status, transfer_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'validated', ?)`,
        args: [who, fondsDir, date, amt, cur, TRANSFER_CATEGORY, desc, transferId],
      },
      {
        sql: `INSERT INTO coffre_entries (employee_name, direction, date, amount, currency, category, description, status, transfer_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'validated', ?)`,
        args: [who, coffreDir, date, amt, cur, TRANSFER_CATEGORY, desc, transferId],
      },
    ])
    return NextResponse.json({ ok: true, transfer_id: transferId }, { status: 201 })
  } catch (error) {
    console.error('POST transfer error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/transfers?id=tr_xxx — supprime les deux mouvements du transfert
export async function DELETE(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    await sqlBatch([
      { sql: 'DELETE FROM fonds_entries WHERE transfer_id = ?', args: [id] },
      { sql: 'DELETE FROM coffre_entries WHERE transfer_id = ?', args: [id] },
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE transfer error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
