import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const type = params.type
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')

    let csv = ''
    let filename = ''

    if (type === 'cb') {
      const entries = month
        ? await sql`SELECT * FROM entries WHERE type='cb' AND strftime('%Y-%m',date)=${month} ORDER BY date DESC`
        : await sql`SELECT * FROM entries WHERE type='cb' ORDER BY date DESC`

      csv = 'Date,Employé,Catégorie,Fournisseur,Mode paiement,Devise,Montant,Facture,Statut\n'
      for (const e of entries) {
        csv += [
          e.date,
          `"${e.employee_name}"`,
          `"${e.category}"`,
          `"${(e.supplier as string) || ''}"`,
          `"${(e.payment as string) || ''}"`,
          (e.currency as string) || 'EUR',
          e.amount,
          `"${(e.invoice_url as string) || ''}"`,
          e.status === 'validated' ? 'Validé' : 'En attente',
        ].join(',') + '\n'
      }
      filename = month ? `depenses-${month}.csv` : 'depenses.csv'
    } else if (type === 'cash') {
      const entries = month
        ? await sql`SELECT * FROM entries WHERE type='cash' AND strftime('%Y-%m',date)=${month} ORDER BY date DESC`
        : await sql`SELECT * FROM entries WHERE type='cash' ORDER BY date DESC`

      csv = 'Date,Employé,Catégorie,Mode paiement,Devise,Montant,Statut\n'
      for (const e of entries) {
        csv += [
          e.date,
          `"${e.employee_name}"`,
          `"${e.category}"`,
          `"${(e.payment as string) || ''}"`,
          (e.currency as string) || 'EUR',
          e.amount,
          e.status === 'validated' ? 'Validé' : 'En attente',
        ].join(',') + '\n'
      }
      filename = month ? `encaissements-${month}.csv` : 'encaissements.csv'
    } else if (type === 'fonds') {
      const entries = month
        ? await sql`SELECT * FROM fonds_entries WHERE strftime('%Y-%m',date)=${month} ORDER BY date DESC`
        : await sql`SELECT * FROM fonds_entries ORDER BY date DESC`

      csv = 'Date,Employé,Sens,Catégorie,Devise,Montant,Description,Statut\n'
      for (const e of entries) {
        csv += [
          e.date,
          `"${e.employee_name}"`,
          e.direction === 'in' ? 'Entrée' : 'Sortie',
          `"${e.category}"`,
          (e.currency as string) || 'MAD',
          e.amount,
          `"${(e.description as string) || ''}"`,
          e.status === 'validated' ? 'Validé' : 'En attente',
        ].join(',') + '\n'
      }
      filename = month ? `fonds-${month}.csv` : 'fonds-roulement.csv'
    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
