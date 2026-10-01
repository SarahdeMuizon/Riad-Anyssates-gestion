import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await ensureDb()
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }

    const emp = await sql`
      SELECT id, name, poste, is_manager FROM employees WHERE token = ${token} AND active = 1
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
