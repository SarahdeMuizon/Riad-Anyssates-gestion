import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const isAuth = await getManagerSession()
  if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const rows = await sql`SELECT key FROM settings WHERE key = 'excel_base_file'`
  return NextResponse.json({ hasFile: rows.length > 0 })
}
