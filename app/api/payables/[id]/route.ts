import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'

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

// Modifier la facture, la régler ({ pay: { date, payment, cash_location } }) ou annuler le règlement ({ unpay: true })
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
      if (p.status === 'paid') return NextResponse.json({ error: 'Déjà réglée' }, { status: 400 })
      const payment = String(b.pay.payment || 'Virement')
      const date = String(b.pay.date || new Date().toISOString().slice(0, 10))
      const loc = payment === 'Espèces' ? (b.pay.cash_location === 'fonds' ? 'fonds' : 'coffre') : null
      // Le règlement crée la dépense correspondante (Dépenses, Banque ou Coffre, et Comptable › Factures d'achat)
      const entry = await sql`
        INSERT INTO entries (employee_name, type, date, amount, category, supplier, payment, description, currency, invoice_url, reference, cash_location, to_accountant)
        VALUES (${getManagerName()}, 'cb', ${date}, ${p.amount}, ${p.category || 'Prestataire'}, ${p.supplier}, ${payment},
          ${p.description || `Facture ${p.supplier}${p.reference ? ` n° ${p.reference}` : ''}`}, ${p.currency || 'MAD'},
          ${p.file_data || null}, ${p.reference || null}, ${loc}, 1)
        RETURNING id`
      await sql`UPDATE payables SET status = 'paid', paid_date = ${date}, payment = ${payment}, entry_id = ${entry[0].id} WHERE id = ${id}`
      return NextResponse.json({ ok: true, entry_id: entry[0].id })
    }

    if (b.unpay) {
      if (p.entry_id) await sql`DELETE FROM entries WHERE id = ${p.entry_id}`
      await sql`UPDATE payables SET status = 'todo', paid_date = NULL, payment = NULL, entry_id = NULL WHERE id = ${id}`
      return NextResponse.json({ ok: true })
    }

    const supplier = String(b.supplier ?? p.supplier).trim().slice(0, 120)
    const amount = b.amount !== undefined ? Number(b.amount) : Number(p.amount)
    if (!supplier || !(amount > 0)) return NextResponse.json({ error: 'Fournisseur et montant requis' }, { status: 400 })
    const file = typeof b.file === 'string' && b.file.startsWith('data:') ? b.file : null
    await sql`
      UPDATE payables SET supplier = ${supplier}, category = ${b.category ?? p.category}, date = ${b.date ?? p.date},
        reference = ${b.reference ?? p.reference}, description = ${b.description ?? p.description}, amount = ${amount},
        currency = ${b.currency ?? p.currency}, due_date = ${b.due_date ?? p.due_date},
        file_data = ${file ?? p.file_data}, filename = ${file ? String(b.filename || 'facture').slice(0, 200) : p.filename}
      WHERE id = ${id}`
    // Facture déjà réglée : la dépense suit les modifications
    if (p.entry_id) {
      await sql`
        UPDATE entries SET amount = ${amount}, supplier = ${supplier}, category = ${b.category ?? p.category},
          currency = ${b.currency ?? p.currency}, reference = ${b.reference ?? p.reference},
          invoice_url = COALESCE(${file}, invoice_url)
        WHERE id = ${p.entry_id}`
    }
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
    const rows = await sql`SELECT status FROM payables WHERE id = ${id}`
    if (rows[0]?.status === 'paid') return NextResponse.json({ error: "Annulez d'abord le règlement" }, { status: 400 })
    await sql`DELETE FROM payables WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE payable error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
