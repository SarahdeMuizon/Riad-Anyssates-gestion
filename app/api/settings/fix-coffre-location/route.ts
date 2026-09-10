import { NextResponse } from 'next/server'
import { sqlBatch } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import data from '../import-coffre-2026/data.json'
 
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
 
const CHUNK_SIZE = 100
 
async function findIds(table: 'coffre_entries' | 'fonds_entries', entries: ImportEntry[]): Promise<(number | null)[]> {
  const ids: (number | null)[] = new Array(entries.length).fill(null)
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE)
    const statements = chunk.map(e => ({
      sql: `SELECT id FROM ${table} WHERE employee_name = ? AND direction = ? AND date = ? AND amount = ? AND category = ? AND description = ? LIMIT 1`,
      args: [e.employee_name, e.direction, e.date, e.amount, e.category, e.description],
    }))
    const results = await sqlBatch(statements)
    results.forEach((rows, j) => {
      if (rows.length > 0) ids[i + j] = rows[0].id as number
    })
  }
  return ids
}
 
export async function POST() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const entries = data.entries as ImportEntry[]
 
    const coffreIds = await findIds('coffre_entries', entries)
    const fondsIds = await findIds('fonds_entries', entries)
 
    const toInsert: ImportEntry[] = []
    const toDeleteFromFonds: number[] = []
 
    entries.forEach((e, i) => {
      if (fondsIds[i] !== null) toDeleteFromFonds.push(fondsIds[i] as number)
      if (coffreIds[i] === null) toInsert.push(e)
    })
 
    let inserted = 0
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(e => ({
        sql: `INSERT INTO coffre_entries (employee_name, direction, date, amount, currency, category, description, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'validated')`,
        args: [e.employee_name, e.direction, e.date, e.amount, e.currency, e.category, e.description],
      }))
      await sqlBatch(statements)
      inserted += chunk.length
    }
 
    let deleted = 0
    for (let i = 0; i < toDeleteFromFonds.length; i += CHUNK_SIZE) {
      const chunk = toDeleteFromFonds.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(id => ({
        sql: `DELETE FROM fonds_entries WHERE id = ?`,
        args: [id],
      }))
      await sqlBatch(statements)
      deleted += chunk.length
    }
 
    const alreadyInCoffre = entries.length - toInsert.length
 
    return NextResponse.json({
      ok: true,
      total: entries.length,
      alreadyInCoffre,
      inserted,
      foundInFonds: toDeleteFromFonds.length,
      deletedFromFonds: deleted,
    })
  } catch (error) {
    console.error('Fix coffre location error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 
