import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'

// Called once to create tables
export async function POST() {
  try {
    await initDb()
    return NextResponse.json({ ok: true, message: 'Base de données initialisée' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Init error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
