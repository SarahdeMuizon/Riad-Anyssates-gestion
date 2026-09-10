import { NextResponse } from 'next/server'
import { sqlBatch } from '@/lib/db'
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
    console.error('Import coffre 2026 error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 
