import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

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

    const entries = await sql`
      SELECT COALESCE(currency, 'MAD') AS cur,
             SUM(CASE WHEN type = 'cash' THEN amount ELSE -amount END) AS total
      FROM entries
      WHERE payment = 'Espèces' AND COALESCE(cash_location, 'fonds') <> 'coffre'
      GROUP BY COALESCE(currency, 'MAD')
    `
    const fonds = await sql`
      SELECT COALESCE(currency, 'MAD') AS cur,
             SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) AS total
      FROM fonds_entries
      GROUP BY COALESCE(currency, 'MAD')
    `
    const bal: Record<string, number> = { MAD: 0, EUR: 0 }
    for (const r of [...entries, ...fonds]) {
      const cur = r.cur === 'EUR' ? 'EUR' : 'MAD'
      bal[cur] += Number(r.total) || 0
    }
    return NextResponse.json({ mad: Math.round(bal.MAD * 100) / 100, eur: Math.round(bal.EUR * 100) / 100 })
  } catch (error) {
    console.error('GET fonds balance error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
