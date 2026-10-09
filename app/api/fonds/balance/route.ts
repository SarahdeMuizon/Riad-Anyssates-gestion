import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { getCashBalance } from '@/lib/cash'

export const dynamic = 'force-dynamic'

// GET /api/fonds/balance?token=XXX
// Solde commun du fond de caisse (le même pour tous les employés et pour le manager) :
// espèces encaissées − espèces dépensées passées par le fond de caisse (hors coffre)
// + mouvements du fond de caisse (transferts coffre ↔ caisse…), par devise.
export async function GET(req: NextRequest) {
  try {
    await ensureDb()
    const token = new URL(req.url).searchParams.get('token')
    if (token) {
      const emp = await sql`SELECT id FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    } else if (!(await getManagerSession())) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    return NextResponse.json(await getCashBalance())
  } catch (error) {
    console.error('GET fonds balance error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
