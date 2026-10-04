import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
 
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const body = await req.json()
    const id = parseInt(params.id)
 
    if (body.invoice_url !== undefined) {
      const result = await sql`UPDATE entries SET invoice_url = ${body.invoice_url} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    if (body.pointed !== undefined) {
      const result = await sql`UPDATE entries SET pointed = ${body.pointed ? 1 : 0} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    if (body.date !== undefined) {
      const d = String(body.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d + 'T00:00:00Z'))) {
        return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      }
      const result = await sql`UPDATE entries SET date = ${d} WHERE id = ${id} RETURNING *`
      if (!result[0]) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      return NextResponse.json(result[0])
    }

    if (body.to_accountant !== undefined) {
      await ensureDb()
      const result = await sql`UPDATE entries SET to_accountant = ${body.to_accountant ? 1 : 0} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }

    if (body.payment !== undefined) {
      const MODES = ['CB', 'Virement', 'Chèque', 'Prélèvement', 'Espèces']
      const payment = String(body.payment)
      if (!MODES.includes(payment)) return NextResponse.json({ error: 'Mode de paiement invalide' }, { status: 400 })
      const loc = payment === 'Espèces' ? (body.cash_location === 'coffre' ? 'coffre' : 'fonds') : null
      const result = await sql`UPDATE entries SET payment = ${payment}, cash_location = ${loc} WHERE id = ${id} RETURNING *`
      if (!result[0]) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
      return NextResponse.json(result[0])
    }

    if (body.reference !== undefined) {
      const result = await sql`UPDATE entries SET reference = ${body.reference || null} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    const { status } = body
    if (status === 'validated') {
      const result = await sql`
        UPDATE entries SET status = 'validated', validated_at = datetime('now')
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    } else if (status === 'pending') {
      const result = await sql`
        UPDATE entries SET status = 'pending', validated_at = NULL
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }
 
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  } catch (error) {
    console.error('PATCH entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const id = parseInt(params.id)
    await sql`DELETE FROM entries WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
