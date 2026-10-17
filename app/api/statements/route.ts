import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATEMENT_SOURCES = ['attijari', 'cmi', 'amex']

// Liste des relevés (sans le contenu des fichiers, chargé à la demande)
export async function GET(req: NextRequest) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')
    // ?period=AAAA-MM : tous les relevés du mois (onglet Comptable) ; sinon ceux d'une banque
    const rows = period
      ? await sql`
        SELECT id, source, period, filename, mime, size, uploaded_by, created_at
        FROM bank_statements WHERE period = ${period} ORDER BY source, id`
      : await sql`
        SELECT id, source, period, filename, mime, size, uploaded_by, created_at
        FROM bank_statements WHERE source = ${searchParams.get('source') || ''} ORDER BY period DESC, id DESC`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET statements error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { source, period, filename, file } = await req.json()
    if (!STATEMENT_SOURCES.includes(source)) return NextResponse.json({ error: 'Banque inconnue' }, { status: 400 })
    if (!/^\d{4}-\d{2}$/.test(String(period))) return NextResponse.json({ error: 'Mois invalide' }, { status: 400 })
    const data = String(file || '')
    if (!data.startsWith('data:')) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    const mime = data.slice(5, data.indexOf(';')) || 'application/octet-stream'
    const size = Math.round((data.length - data.indexOf(',') - 1) * 3 / 4)
    const result = await sql`
      INSERT INTO bank_statements (source, period, filename, mime, size, file_data, uploaded_by)
      VALUES (${source}, ${period}, ${String(filename || 'releve').slice(0, 200)}, ${mime}, ${size}, ${data}, ${getManagerName()})
      RETURNING id, source, period, filename, mime, size, uploaded_by, created_at`
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
