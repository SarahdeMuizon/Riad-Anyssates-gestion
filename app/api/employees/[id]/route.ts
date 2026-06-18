import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const id = parseInt(params.id)
    const { active, name, poste } = await req.json()

    if (typeof active === 'boolean') {
      // SQLite stores booleans as 0/1
      const result = await sql`
        UPDATE employees SET active = ${active ? 1 : 0} WHERE id = ${id} RETURNING *
      `
      const emp = result[0]
      return NextResponse.json({ ...emp, active: emp.active === 1 || emp.active === true })
    }

    if (name !== undefined || poste !== undefined) {
      const result = await sql`
        UPDATE employees
        SET name = COALESCE(${name || null}, name),
            poste = COALESCE(${poste || null}, poste)
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }

    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  } catch (error) {
    console.error('PATCH employee error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
