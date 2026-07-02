import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'

async function init() {
  await initDb()
  return NextResponse.json({ ok: true, message: 'Base de données initialisée' })
}

// Called once to create tables
export async function POST() {
  try {
    return await init()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Init error:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET() {
  try {
    return await init()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Init error:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
