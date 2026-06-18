import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

function generateToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employees = await sql`
      SELECT * FROM employees ORDER BY active DESC, name ASC
    `
    // SQLite stores booleans as 0/1 — convert for the frontend
    return NextResponse.json(employees.map(e => ({ ...e, active: e.active === 1 || e.active === true })))
  } catch (error) {
    console.error('GET employees error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { name, poste } = await req.json()
    if (!name) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const token = generateToken()
    const result = await sql`
      INSERT INTO employees (name, poste, token)
      VALUES (${name}, ${poste || 'Employé'}, ${token})
      RETURNING *
    `

    const emp = result[0]
    return NextResponse.json({ ...emp, active: emp.active === 1 || emp.active === true }, { status: 201 })
  } catch (error) {
    console.error('POST employee error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
