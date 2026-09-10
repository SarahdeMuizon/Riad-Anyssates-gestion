import { NextResponse } from 'next/server'
import { sqlBatch } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import data from './data.json'
 
export const dynamic = 'force-dynamic'
export const maxDuration = 60
 
interface ImportEntry {
  date: string
  type: 'cb' | 'cash'
  amount: number
  category: string
  payment: string | null
  reference: string | null
  description: string
  currency: string
  employee_name: string
}
 
const CHUNK_SIZE = 150
 
// POST — import ponctuel de l'historique du relevé BANQUE 2026 fourni par
// Valérie (705 lignes, de nov. 2025 à sept. 2026). Met à jour le solde
// bancaire initial (settings.solde_bancaire_mad) puis insère chaque ligne
// dans `entries`. Conçu pour être déclenché UNE SEULE FOIS — relancer
// dupliquerait toutes les entrées.
export async function POST() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const entries = data.entries as ImportEntry[]
    const soldeInitial = data.solde_initial_mad as number
 
    // 1) Solde bancaire initial (ligne "REPORT 2025" du relevé)
    await sqlBatch([
      { sql: `UPDATE settings SET value = ? WHERE key = 'solde_bancaire_mad'`, args: [String(soldeInitial)] },
    ])
 
    // 2) Les 705 mouvements, par lots pour rester dans le temps imparti
    let inserted = 0
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(e => ({
        sql: `INSERT INTO entries (employee_name, type, date, amount, category, payment, description, currency, reference, status, pointed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'validated', 0)`,
        args: [e.employee_name, e.type, e.date, e.amount, e.category, e.payment, e.description, e.currency, e.reference],
      }))
      await sqlBatch(statements)
      inserted += chunk.length
    }
 
    return NextResponse.json({ ok: true, inserted, soldeInitial })
  } catch (error) {
    console.error('Import banque 2026 error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 
