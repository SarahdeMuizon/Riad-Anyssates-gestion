import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { getTaxeSejour } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const t = await getTaxeSejour()
    return NextResponse.json({ taxe_sejour_tarif: t.rate, taxe_sejour_devise: t.currency })
  } catch (error) {
    console.error('GET taxe-sejour error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { taxe_sejour_tarif, taxe_sejour_devise } = await req.json()
    if (taxe_sejour_tarif !== undefined) {
      const v = parseFloat(taxe_sejour_tarif)
      if (isNaN(v) || v < 0) return NextResponse.json({ error: 'Tarif invalide' }, { status: 400 })
      await sql`INSERT INTO settings (key, value) VALUES ('taxe_sejour_tarif', ${String(v)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }
    if (taxe_sejour_devise !== undefined) {
      if (taxe_sejour_devise !== 'EUR' && taxe_sejour_devise !== 'MAD') return NextResponse.json({ error: 'Devise invalide' }, { status: 400 })
      await sql`INSERT INTO settings (key, value) VALUES ('taxe_sejour_devise', ${taxe_sejour_devise}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH taxe-sejour error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
