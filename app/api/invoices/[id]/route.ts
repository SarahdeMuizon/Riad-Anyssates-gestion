import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
import { computeInvoice, invoiceExtras, parseExtras, type Invoice } from '@/lib/invoice'
import { removeInvoice, getTvaRates, getTaxeSejourChildRate } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'

// Correction d'une facture (client, nuits, personnes, lignes…) : le numéro ne change pas,
// et le tarif de taxe de séjour reste celui en vigueur à la création.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const id = parseInt(params.id)
    const inv = (await sql`SELECT * FROM invoices WHERE id = ${id}`)[0] as unknown as Invoice | undefined
    if (!inv) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    if ((inv as unknown as { cancelled?: number }).cancelled) return NextResponse.json({ error: 'Cette facture est annulée' }, { status: 400 })
    const body = await req.json()

    const date = String(body.date || inv.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    if (parseInt(date.substring(0, 4), 10) !== inv.year) {
      return NextResponse.json({ error: `La date doit rester en ${inv.year} (numéro ${inv.number})` }, { status: 400 })
    }
    // Factures créées avant le tarif enfant : on prend le tarif enfant actuel
    const childRate = Number(inv.child_rate) > 0 ? Number(inv.child_rate) : await getTaxeSejourChildRate()
    const gross = Number(body.amount_mad) > 0 ? Number(body.amount_mad) : Number(inv.amount_total)
    const c = computeInvoice({
      gross,
      nights: body.nights !== undefined ? Number(body.nights) : Number(inv.nights),
      persons: body.persons !== undefined ? Number(body.persons) : Number(inv.persons),
      children: body.children !== undefined ? Number(body.children) : Number(inv.children || 0),
      taxRate: Number(inv.tax_rate),
      childRate,
      extras: body.extras !== undefined ? parseExtras(body.extras) : invoiceExtras(inv),
      rates: await getTvaRates(),
    })
    if (!c.valid) return NextResponse.json({ error: 'La taxe de séjour et les lignes dépassent le montant encaissé' }, { status: 400 })
    const clientName = body.client_name !== undefined ? (String(body.client_name).trim().slice(0, 200) || null) : inv.client_name

    const result = await sql`
      UPDATE invoices SET date = ${date}, client_name = ${clientName}, lines = ${JSON.stringify(c.lines)},
        nights = ${c.nights}, persons = ${c.persons}, children = ${c.children}, child_rate = ${childRate}, tax_amount = ${c.taxAmount}, tax_included = 1, tva_rate = 0,
        amount_lodging = ${c.prestations}, amount_total = ${c.total}, currency = 'MAD'
      WHERE id = ${id} RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('PATCH invoice error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Facture faite par erreur : supprimée si c'est la dernière de l'année, sinon annulée
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const result = await removeInvoice(parseInt(params.id))
    if (!result) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('DELETE invoice error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
