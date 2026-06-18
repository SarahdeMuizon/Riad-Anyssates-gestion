import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const type = params.type // 'cb' or 'cash'
    if (type !== 'cb' && type !== 'cash') {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    const entries = await sql`
      SELECT * FROM entries WHERE type = ${type} ORDER BY date DESC, created_at DESC
    `

    let csv = ''
    if (type === 'cb') {
      csv = 'Date,Employé,Catégorie,Fournisseur,Mode paiement,Montant,Statut,Description\n'
      for (const e of entries) {
        csv += [
          e.date,
          `"${e.employee_name}"`,
          `"${e.category}"`,
          `"${e.supplier || ''}"`,
          `"${e.payment || ''}"`,
          e.amount,
          e.status === 'validated' ? 'Validé' : 'En attente',
          `"${e.description || ''}"`,
        ].join(',') + '\n'
      }
    } else {
      csv = 'Date,Employé,Catégorie,Montant,Statut,Description\n'
      for (const e of entries) {
        csv += [
          e.date,
          `"${e.employee_name}"`,
          `"${e.category}"`,
          e.amount,
          e.status === 'validated' ? 'Validé' : 'En attente',
          `"${e.description || ''}"`,
        ].join(',') + '\n'
      }
    }

    const filename = type === 'cb' ? 'depenses.csv' : 'encaissements.csv'
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
