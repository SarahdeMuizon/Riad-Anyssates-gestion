import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const rows = await sql`SELECT key, value FROM settings WHERE key IN ('solde_bancaire_mad', 'solde_bancaire_eur')`
    const result: Record<string, number> = { solde_bancaire_mad: 0, solde_bancaire_eur: 0 }
    for (const row of rows) {
      result[row.key as string] = parseFloat(row.value as string) || 0
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET solde-bancaire error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { solde_bancaire_mad, solde_bancaire_eur } = await req.json()

    if (solde_bancaire_mad !== undefined) {
      await sql`INSERT INTO settings (key, value) VALUES ('solde_bancaire_mad', ${String(solde_bancaire_mad)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }
    if (solde_bancaire_eur !== undefined) {
      await sql`INSERT INTO settings (key, value) VALUES ('solde_bancaire_eur', ${String(solde_bancaire_eur)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH solde-bancaire error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
