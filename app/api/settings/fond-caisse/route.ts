import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const rows = await sql`SELECT key, value FROM settings WHERE key IN ('fond_caisse_mad', 'fond_caisse_eur')`
    const result: Record<string, number> = { fond_caisse_mad: 2000, fond_caisse_eur: 200 }
    for (const row of rows) {
      result[row.key as string] = parseFloat(row.value as string) || 0
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET fond-caisse error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { fond_caisse_mad, fond_caisse_eur } = await req.json()

    if (fond_caisse_mad !== undefined) {
      await sql`INSERT INTO settings (key, value) VALUES ('fond_caisse_mad', ${String(fond_caisse_mad)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }
    if (fond_caisse_eur !== undefined) {
      await sql`INSERT INTO settings (key, value) VALUES ('fond_caisse_eur', ${String(fond_caisse_eur)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH fond-caisse error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
