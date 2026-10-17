import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { computeInvoice, entryGross, parseExtras } from '@/lib/invoice'
import { getTaxeSejourRate, getTaxeSejourChildRate, getTvaRates, cleanupOrphanInvoices } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    await cleanupOrphanInvoices()
    const rows = await sql`SELECT * FROM invoices ORDER BY year DESC, seq DESC`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET invoices error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Crée la facture de vente d'un encaissement : numéro suivant de l'année, taxe de séjour
// déduite du montant payé, et l'encaissement passe dans la liste du comptable.
export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await req.json()
    const entryId = parseInt(body.entry_id)
    const entry = (await sql`SELECT * FROM entries WHERE id = ${entryId}`)[0]
    if (!entry || entry.type !== 'cash') return NextResponse.json({ error: 'Encaissement introuvable' }, { status: 404 })
    const existing = await sql`SELECT number FROM invoices WHERE entry_id = ${entryId}`
    if (existing[0]) return NextResponse.json({ error: `Cet encaissement a déjà la facture ${existing[0].number}` }, { status: 409 })

    const date = String(body.date || entry.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    const year = parseInt(date.substring(0, 4), 10)
    // La facture est toujours en dirhams : un encaissement en euros demande son montant en MAD
    const gross = (entry.currency as string) === 'EUR'
      ? Number(body.amount_mad) || 0
      : entryGross(entry as { amount: number; amount_ht?: number; payment?: string })
    if (gross <= 0) return NextResponse.json({ error: 'Indiquez le montant en dirhams' }, { status: 400 })
    const taxRate = await getTaxeSejourRate()
    const childRate = await getTaxeSejourChildRate()
    const c = computeInvoice({ gross, nights: Number(body.nights), persons: Number(body.persons), children: Number(body.children), taxRate, childRate, extras: parseExtras(body.extras), rates: await getTvaRates() })
    if (!c.valid) return NextResponse.json({ error: 'La taxe de séjour et les lignes dépassent le montant encaissé' }, { status: 400 })

    const clientName = String(body.client_name ?? entry.supplier ?? '').trim().slice(0, 200) || null

    // Numéro attribué dans la même requête que l'insertion : pas de doublon possible
    const result = await sql`
      INSERT INTO invoices (number, year, seq, entry_id, date, client_name, lines, nights, persons, children, tax_rate, child_rate, tax_amount, tax_currency, tax_included, tva_rate, amount_lodging, amount_total, currency, payment)
      SELECT printf('FA-%d-%04d', ${year}, COALESCE(MAX(seq), 0) + 1), ${year}, COALESCE(MAX(seq), 0) + 1,
        ${entryId}, ${date}, ${clientName}, ${JSON.stringify(c.lines)}, ${c.nights}, ${c.persons}, ${c.children}, ${taxRate}, ${childRate}, ${c.taxAmount}, 'MAD', 1, 0, ${c.prestations}, ${c.total}, 'MAD', ${(entry.payment as string) || null}
      FROM invoices WHERE year = ${year}
      RETURNING *
    `
    await sql`UPDATE entries SET to_accountant = 1, supplier = COALESCE(supplier, ${clientName}) WHERE id = ${entryId}`
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST invoice error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
