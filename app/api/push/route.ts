import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { getVapidKeys } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// GET : clé publique nécessaire au navigateur pour s'abonner
export async function GET() {
  try {
    await ensureDb()
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { publicKey } = await getVapidKeys()
    return NextResponse.json({ publicKey })
  } catch (error) {
    console.error('GET push error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST : enregistre l'abonnement push de cet appareil pour l'administrateur connecté
export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { subscription } = await req.json()
    const endpoint = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const auth = subscription?.keys?.auth
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 })
    const me = getManagerName()
    await sql`INSERT INTO push_subs (endpoint, p256dh, auth, manager_name) VALUES (${endpoint}, ${p256dh}, ${auth}, ${me})
              ON CONFLICT(endpoint) DO UPDATE SET p256dh = ${p256dh}, auth = ${auth}, manager_name = ${me}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST push error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE : désabonne cet appareil
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { endpoint } = await req.json().catch(() => ({}))
    if (endpoint) await sql`DELETE FROM push_subs WHERE endpoint = ${endpoint}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE push error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
