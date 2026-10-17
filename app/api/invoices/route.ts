import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { computeInvoice, entryGross } from '@/lib/invoice'
import { getTaxeSejour } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`SELECT * FROM invoices ORDER BY year DESC, seq DESC`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET invoices error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Crée la facture de vente d'un encaissement : numéro suivant de l'année,
// calcul de la taxe de séjour, et l'encaissement passe dans la liste du comptable.
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
    const currency = (entry.currency as string) || 'MAD'
    const { rate: taxRate, currency: taxCurrency } = await getTaxeSejour()
    const tvaRate = Math.max(0, parseFloat(body.tva_rate) || 0)
    const c = computeInvoice({
      gross: entryGross(entry as { amount: number; amount_ht?: number; payment?: string }),
      currency, nights: Number(body.nights), persons: Number(body.persons),
      taxRate, taxCurrency, taxIncluded: body.tax_included !== false, tvaRate,
    })
    if (c.lodging < 0) return NextResponse.json({ error: 'La taxe de séjour dépasse le montant encaissé' }, { status: 400 })

    const clientName = String(body.client_name ?? entry.supplier ?? '').trim().slice(0, 200) || null
    const description = String(body.description ?? '').trim().slice(0, 500) || null

    // Numéro attribué dans la même requête que l'insertion : pas de doublon possible
    const result = await sql`
      INSERT INTO invoices (number, year, seq, entry_id, date, client_name, description, nights, persons, tax_rate, tax_amount, tax_currency, tax_included, tva_rate, amount_lodging, amount_total, currency, payment)
      SELECT printf('FA-%d-%04d', ${year}, COALESCE(MAX(seq), 0) + 1), ${year}, COALESCE(MAX(seq), 0) + 1,
        ${entryId}, ${date}, ${clientName}, ${description}, ${c.nights}, ${c.persons}, ${taxRate}, ${c.taxAmount}, ${taxCurrency}, ${c.taxIncluded ? 1 : 0}, ${tvaRate}, ${c.lodging}, ${c.total}, ${currency}, ${(entry.payment as string) || null}
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
