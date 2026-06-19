import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { status } = await req.json()
    const id = parseInt(params.id)

    if (status === 'validated') {
      const result = await sql`UPDATE fonds_entries SET status='validated', validated_at=datetime('now') WHERE id=${id} RETURNING *`
      return NextResponse.json(result[0])
    } else if (status === 'pending') {
      const result = await sql`UPDATE fonds_entries SET status='pending', validated_at=NULL WHERE id=${id} RETURNING *`
      return NextResponse.json(result[0])
    }

    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  } catch (error) {
    console.error('PATCH fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    await sql`DELETE FROM fonds_entries WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE fonds error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
