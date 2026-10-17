import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { supplierMode } from '@/lib/payables'
import { linkBons, refreshPayableStatus, removePayment } from '@/lib/payables-db'

export const dynamic = 'force-dynamic'

// Fichier de la facture fournisseur
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`SELECT file_data, filename FROM payables WHERE id = ${parseInt(params.id)}`
    if (!rows[0]?.file_data) return NextResponse.json({ error: 'Aucun fichier' }, { status: 404 })
    return NextResponse.json({ file: rows[0].file_data, filename: rows[0].filename })
  } catch (error) {
    console.error('GET payable file error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Modifier la facture, enregistrer un règlement ({ pay: { date, payment, cash_location, amount } } : acompte ou solde),
// annuler un règlement ({ unpay_payment: id }) ou tous ({ unpay: true })
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const id = parseInt(params.id)
    const rows = await sql`SELECT * FROM payables WHERE id = ${id}`
    const p = rows[0]
    if (!p) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const b = await req.json()

    if (b.pay) {
      if (p.kind === 'bon') return NextResponse.json({ error: 'Un bon se règle avec la facture de fin de mois' }, { status: 400 })
      const paidRows = await sql`SELECT COALESCE(SUM(amount), 0) AS paid FROM payable_payments WHERE payable_id = ${id}`
      const remaining = Math.round((Number(p.amount) - Number(paidRows[0].paid)) * 100) / 100
      if (remaining <= 0.009) return NextResponse.json({ error: 'Déjà réglée' }, { status: 400 })
      const amount = b.pay.amount !== undefined ? Math.round(Number(b.pay.amount) * 100) / 100 : remaining
      if (!(amount > 0) || amount > remaining + 0.01) return NextResponse.json({ error: `Montant invalide (reste à payer : ${remaining})` }, { status: 400 })
      const payment = String(b.pay.payment || 'Virement')
      const date = String(b.pay.date || new Date().toISOString().slice(0, 10))
      const loc = payment === 'Espèces' ? (b.pay.cash_location === 'fonds' ? 'fonds' : 'coffre') : null
      const label = `Facture ${p.supplier}${p.period && supplierMode(p.supplier as string) ? ` ${p.period}` : ''}${p.reference ? ` n° ${p.reference}` : ''}`
      const what = amount >= remaining - 0.01 ? (Number(paidRows[0].paid) > 0 ? 'Solde — ' : '') : 'Acompte — '
      // Le règlement crée la dépense correspondante (Dépenses, Banque ou Coffre, et Comptable › Factures d'achat)
      const entry = await sql`
        INSERT INTO entries (employee_name, type, date, amount, category, supplier, payment, description, currency, invoice_url, reference, cash_location, to_accountant)
        VALUES (${getManagerName()}, 'cb', ${date}, ${amount}, ${p.category || 'Prestataire'}, ${p.supplier}, ${payment},
          ${what + (p.description || label)}, ${p.currency || 'MAD'}, ${p.file_data || null}, ${p.reference || null}, ${loc}, 1)
        RETURNING id`
      await sql`INSERT INTO payable_payments (payable_id, date, amount, payment, entry_id) VALUES (${id}, ${date}, ${amount}, ${payment}, ${entry[0].id})`
      await refreshPayableStatus(id)
      return NextResponse.json({ ok: true, entry_id: entry[0].id })
    }

    if (b.unpay_payment) {
      const own = await sql`SELECT id FROM payable_payments WHERE id = ${Number(b.unpay_payment)} AND payable_id = ${id}`
      if (own[0]) await removePayment(own[0].id as number)
      return NextResponse.json({ ok: true })
    }

    if (b.unpay) {
      const pays = await sql`SELECT id FROM payable_payments WHERE payable_id = ${id}`
      for (const x of pays) await removePayment(x.id as number)
      return NextResponse.json({ ok: true })
    }

    const supplier = String(b.supplier ?? p.supplier).trim().slice(0, 120)
    const amount = b.amount !== undefined ? Number(b.amount) : Number(p.amount)
    if (!supplier || !(amount > 0)) return NextResponse.json({ error: 'Fournisseur et montant requis' }, { status: 400 })
    const file = typeof b.file === 'string' && b.file.startsWith('data:') ? b.file : null
    await sql`
      UPDATE payables SET supplier = ${supplier}, category = ${b.category ?? p.category}, date = ${b.date ?? p.date}, period = ${b.period ?? p.period},
        reference = ${b.reference ?? p.reference}, description = ${b.description ?? p.description}, notes = ${b.notes ?? p.notes}, amount = ${amount},
        currency = ${b.currency ?? p.currency}, due_date = ${b.due_date ?? p.due_date},
        file_data = ${file ?? p.file_data}, filename = ${file ? String(b.filename || 'facture').slice(0, 200) : p.filename}
      WHERE id = ${id}`
    if (p.kind !== 'bon' && Array.isArray(b.bon_ids)) await linkBons(id, b.bon_ids)
    // Dépenses déjà créées par les règlements : elles suivent le fournisseur, la catégorie et la facture jointe
    await sql`
      UPDATE entries SET supplier = ${supplier}, category = ${b.category ?? p.category}, reference = ${b.reference ?? p.reference},
        invoice_url = COALESCE(${file}, invoice_url)
      WHERE id IN (SELECT entry_id FROM payable_payments WHERE payable_id = ${id})`
    // Montant modifié : la facture peut redevenir à payer (ou être soldée)
    await refreshPayableStatus(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH payable error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb()
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const id = parseInt(params.id)
    const pays = await sql`SELECT id FROM payable_payments WHERE payable_id = ${id} LIMIT 1`
    if (pays[0]) return NextResponse.json({ error: "Annulez d'abord les règlements" }, { status: 400 })
    // Facture supprimée : ses bons redeviennent « non facturés »
    await sql`UPDATE payables SET invoice_id = NULL WHERE invoice_id = ${id}`
    await sql`DELETE FROM payables WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE payable error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
