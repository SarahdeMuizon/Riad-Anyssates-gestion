import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }

    const emp = await sql`
      SELECT id, name, poste FROM employees WHERE token = ${token} AND active = 1
    `
    if (!emp[0]) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    return NextResponse.json(emp[0])
  } catch (error) {
    console.error('Verify employee error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
