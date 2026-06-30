import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const endMonth = searchParams.get('month') || defaultMonth

    const [y, m] = endMonth.split('-').map(Number)
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const rows = await Promise.all(months.map(async mo => {
      const [dep, enc] = await Promise.all([
        sql`SELECT SUM(amount) as total FROM entries WHERE type='cb' AND strftime('%Y-%m',date)=${mo}`,
        sql`SELECT SUM(amount) as total FROM entries WHERE type='cash' AND strftime('%Y-%m',date)=${mo}`,
      ])
      return {
        month: mo,
        depenses: parseFloat((dep[0]?.total as string) || '0') || 0,
        encaissements: parseFloat((enc[0]?.total as string) || '0') || 0,
      }
    }))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Trend error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
