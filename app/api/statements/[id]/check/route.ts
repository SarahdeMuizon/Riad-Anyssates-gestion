import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { extractStatement, reconcile, type AppMovement, type StatementExtract } from '@/lib/bank-check'

export const dynamic = 'force-dynamic'
// La lecture d'un relevé de plusieurs pages peut prendre une à deux minutes
export const maxDuration = 300

// Contrôle d'un relevé Attijari : la lecture du relevé est gardée en base (une seule
// lecture par relevé, sauf ?refresh=1), le rapprochement est refait à chaque fois
// pour tenir compte des saisies corrigées entre-temps.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })

    const id = parseInt(params.id)
    const row = (await sql`SELECT source, period, mime, file_data, analysis FROM bank_statements WHERE id = ${id}`)[0]
    if (!row) return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 })
    if (row.source !== 'attijari') return NextResponse.json({ error: 'Le contrôle se fait sur le relevé Attijari' }, { status: 400 })
    if (!/^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(String(row.mime))) {
      return NextResponse.json({ error: 'Contrôle possible sur un relevé PDF ou une photo (pas Excel/CSV)' }, { status: 400 })
    }

    const period = row.period as string
    const refresh = new URL(req.url).searchParams.get('refresh') === '1'
    let ext: StatementExtract
    if (row.analysis && !refresh) {
      ext = JSON.parse(row.analysis as string)
    } else {
      ext = await extractStatement(row.file_data as string, period)
      await sql`UPDATE bank_statements SET analysis = ${JSON.stringify(ext)} WHERE id = ${id}`
    }

    // Mouvements bancaires saisis (hors espèces), avec 7 jours de marge autour du mois
    const start = new Date(`${period}-01T00:00:00Z`)
    const from = new Date(start.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 7)).toISOString().slice(0, 10)
    const rows = await sql`
      SELECT id, date, type, amount, payment, supplier, category, description FROM entries
      WHERE payment IS NOT NULL AND payment != 'Espèces' AND COALESCE(currency, 'MAD') = 'MAD'
        AND date >= ${from} AND date <= ${to}`
    const movements: AppMovement[] = rows.map(r => ({
      id: r.id as number, date: r.date as string, type: r.type as 'cb' | 'cash', amount: Number(r.amount),
      payment: r.payment as string, label: [r.supplier, r.category, r.description].filter(Boolean).join(' · '),
    }))

    return NextResponse.json({ period, lines: ext.lines.length, report: reconcile(ext, movements, period) })
  } catch (error) {
    console.error('POST statement check error:', error)
    return NextResponse.json({ error: 'Le relevé n’a pas pu être contrôlé — réessayez.' }, { status: 500 })
  }
}
