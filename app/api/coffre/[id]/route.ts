import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
 
export const dynamic = 'force-dynamic'
 
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const body = await req.json()
    const id = parseInt(params.id)
 
    if (body.invoice_url !== undefined) {
      const result = await sql`UPDATE coffre_entries SET invoice_url = ${body.invoice_url} WHERE id = ${id} RETURNING *`
      return NextResponse.json(result[0])
    }
 
    const { status } = body
    await sql`UPDATE coffre_entries SET status = ${status} WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH coffre error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    await sql`DELETE FROM coffre_entries WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE coffre error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 

