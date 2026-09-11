import { NextResponse } from 'next/server'
import sql, { sqlBatch } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import data from './data.json'
 
export const dynamic = 'force-dynamic'
export const maxDuration = 60
 
interface ImportEntry {
  date: string
  direction: 'in' | 'out'
  amount: number
  category: string
  description: string
  currency: string
  employee_name: string
}
 
const CHUNK_SIZE = 150
 
export async function POST() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    // Garde-fou anti-doublon : le premier import (623 lignes) n'a jamais
    // contenu de mouvements en EUR, donc s'il en existe déjà, cet import a
    // déjà été fait — on refuse de le rejouer.
    const existing = await sql`SELECT COUNT(*) as n FROM coffre_entries WHERE currency = 'EUR'`
    const existingCount = Number(existing[0]?.n || 0)
    if (existingCount > 0) {
      return NextResponse.json(
        { error: `Import déjà effectué : ${existingCount} lignes en EUR existent déjà dans le Coffre-fort.` },
        { status: 409 }
      )
    }
 
    const entries = data.entries as ImportEntry[]
 
    let inserted = 0
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(e => ({
        sql: `INSERT INTO coffre_entries (employee_name, direction, date, amount, currency, category, description, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'validated')`,
        args: [e.employee_name, e.direction, e.date, e.amount, e.currency, e.category, e.description],
      }))
      await sqlBatch(statements)
      inserted += chunk.length
    }
 
    return NextResponse.json({ ok: true, inserted })
  } catch (error) {
    console.error('Import coffre EUR 2026 error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 

