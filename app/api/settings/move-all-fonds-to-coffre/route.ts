import { NextResponse } from 'next/server'
import sql, { sqlBatch } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
 
export const dynamic = 'force-dynamic'
export const maxDuration = 60
 
const CHUNK_SIZE = 100
 
export async function POST() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const rows = await sql`SELECT * FROM fonds_entries`
 
    let moved = 0
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(r => ({
        sql: `INSERT INTO coffre_entries (employee_name, direction, date, amount, currency, category, description, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.employee_name,
          r.direction,
          r.date,
          r.amount,
          r.currency || 'MAD',
          r.category,
          r.description ?? null,
          r.status || 'validated',
        ],
      }))
      await sqlBatch(statements)
      moved += chunk.length
    }
 
    await sql`DELETE FROM fonds_entries`
 
    return NextResponse.json({ ok: true, moved })
  } catch (error) {
    console.error('Move all fonds to coffre error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 
