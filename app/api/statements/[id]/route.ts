import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Contenu d'un relevé (data URL), pour le consulter ou le télécharger
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`SELECT filename, file_data FROM bank_statements WHERE id = ${parseInt(params.id)}`
    if (!rows[0]) return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('GET statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    await sql`DELETE FROM bank_statements WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
