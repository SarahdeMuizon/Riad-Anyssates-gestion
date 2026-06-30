import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const isAuth = await getManagerSession()
  if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (!file.name.endsWith('.xlsx')) return NextResponse.json({ error: 'Format .xlsx requis' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    await sql`INSERT INTO settings (key, value) VALUES ('excel_base_file', ${base64})
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`

    return NextResponse.json({ ok: true, filename: file.name, size: bytes.byteLength })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  const isAuth = await getManagerSession()
  if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await sql`DELETE FROM settings WHERE key = 'excel_base_file'`
  return NextResponse.json({ ok: true })
}
