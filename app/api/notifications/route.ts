import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET : dernières notifications + nombre de non lues pour l'administrateur connecté
// (ses propres actions ne comptent pas comme non lues)
export async function GET() {
  try {
    await ensureDb()
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const me = getManagerName()
    const seen = await sql`SELECT last_seen_id FROM notif_seen WHERE manager_name = ${me}`
    const lastSeen = Number(seen[0]?.last_seen_id || 0)
    const items = await sql`SELECT * FROM notifications ORDER BY id DESC LIMIT 50`
    const unread = await sql`SELECT COUNT(*) AS n FROM notifications WHERE id > ${lastSeen} AND COALESCE(actor, '') <> ${me}`
    return NextResponse.json({ items, unread: Number(unread[0]?.n || 0), lastSeen, me })
  } catch (error) {
    console.error('GET notifications error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST : marque toutes les notifications comme vues
export async function POST(_req: NextRequest) {
  try {
    await ensureDb()
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const me = getManagerName()
    const max = await sql`SELECT COALESCE(MAX(id), 0) AS m FROM notifications`
    const m = Number(max[0]?.m || 0)
    await sql`INSERT INTO notif_seen (manager_name, last_seen_id) VALUES (${me}, ${m})
              ON CONFLICT(manager_name) DO UPDATE SET last_seen_id = ${m}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST notifications error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
