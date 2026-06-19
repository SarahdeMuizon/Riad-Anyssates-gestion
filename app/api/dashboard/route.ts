import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // month format: 'YYYY-MM' — defaults to current month
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = searchParams.get('month') || defaultMonth

    const [totalsDepenses, totalsEncaissements, totalsFonds, pendingCount, validatedCount, depensesByCategory, encaissementsByCategory] = await Promise.all([
      sql`
        SELECT SUM(amount) as total
        FROM entries WHERE type = 'cb'
        AND strftime('%Y-%m', date) = ${month}
      `,
      sql`
        SELECT SUM(amount) as total
        FROM entries WHERE type = 'cash'
        AND strftime('%Y-%m', date) = ${month}
      `,
      sql`
        SELECT
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as total_in,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as total_out
        FROM fonds_entries
        WHERE strftime('%Y-%m', date) = ${month}
      `,
      sql`SELECT COUNT(*) as count FROM entries WHERE status = 'pending' AND strftime('%Y-%m', date) = ${month}`,
      sql`SELECT COUNT(*) as count FROM entries WHERE status = 'validated' AND strftime('%Y-%m', date) = ${month}`,
      sql`
        SELECT category, SUM(amount) as total
        FROM entries WHERE type = 'cb'
        AND strftime('%Y-%m', date) = ${month}
        GROUP BY category ORDER BY total DESC
      `,
      sql`
        SELECT category, SUM(amount) as total
        FROM entries WHERE type = 'cash'
        AND strftime('%Y-%m', date) = ${month}
        GROUP BY category ORDER BY total DESC
      `,
    ])

    return NextResponse.json({
      total_depenses: parseFloat((totalsDepenses[0]?.total as string) || '0') || 0,
      total_encaissements: parseFloat((totalsEncaissements[0]?.total as string) || '0') || 0,
      total_fonds_in: parseFloat((totalsFonds[0]?.total_in as string) || '0') || 0,
      total_fonds_out: parseFloat((totalsFonds[0]?.total_out as string) || '0') || 0,
      pending_count: parseInt((pendingCount[0]?.count as string) || '0'),
      validated_count: parseInt((validatedCount[0]?.count as string) || '0'),
      depenses_by_category: depensesByCategory.map(r => ({ category: r.category, total: parseFloat(r.total as string) })),
      encaissements_by_category: encaissementsByCategory.map(r => ({ category: r.category, total: parseFloat(r.total as string) })),
      month,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
