import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const [totals, pendingCount, validatedCount, cbByCategory, cashByCategory] = await Promise.all([
      sql`
        SELECT
          SUM(CASE WHEN type = 'cb' THEN amount ELSE 0 END) as total_cb,
          SUM(CASE WHEN type = 'cash' THEN amount ELSE 0 END) as total_cash
        FROM entries
      `,
      sql`SELECT COUNT(*) as count FROM entries WHERE status = 'pending'`,
      sql`SELECT COUNT(*) as count FROM entries WHERE status = 'validated'`,
      sql`
        SELECT category, SUM(amount) as total
        FROM entries WHERE type = 'cb'
        GROUP BY category ORDER BY total DESC
      `,
      sql`
        SELECT category, SUM(amount) as total
        FROM entries WHERE type = 'cash'
        GROUP BY category ORDER BY total DESC
      `,
    ])

    return NextResponse.json({
      total_cb: parseFloat((totals[0]?.total_cb as string) || '0'),
      total_cash: parseFloat((totals[0]?.total_cash as string) || '0'),
      pending_count: parseInt((pendingCount[0]?.count as string) || '0'),
      validated_count: parseInt((validatedCount[0]?.count as string) || '0'),
      cb_by_category: cbByCategory.map(r => ({ category: r.category, total: parseFloat(r.total as string) })),
      cash_by_category: cashByCategory.map(r => ({ category: r.category, total: parseFloat(r.total as string) })),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
