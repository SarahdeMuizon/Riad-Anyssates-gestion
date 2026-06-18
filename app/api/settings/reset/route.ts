import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export async function DELETE() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    await sql`DELETE FROM entries`
    await sql`DELETE FROM employees`
    await sql`UPDATE settings SET value = 'gestion2026' WHERE key = 'pin'`

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reset error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
