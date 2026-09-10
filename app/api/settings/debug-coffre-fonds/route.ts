import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
 
export const dynamic = 'force-dynamic'
 
export async function GET() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    const [
      coffreCount, fondsCount,
      coffreAdminCount, fondsAdminCount,
      coffreSample, fondsSample,
      coffreFirst, fondsFirstReport,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as n FROM coffre_entries`,
      sql`SELECT COUNT(*) as n FROM fonds_entries`,
      sql`SELECT COUNT(*) as n FROM coffre_entries WHERE employee_name = 'Administrateur'`,
      sql`SELECT COUNT(*) as n FROM fonds_entries WHERE employee_name = 'Administrateur'`,
      sql`SELECT id, date, direction, amount, category, description, created_at FROM coffre_entries ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT id, date, direction, amount, category, description, created_at FROM fonds_entries ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT id, date, description FROM coffre_entries WHERE description LIKE '%REPORT 2025%'`,
      sql`SELECT id, date, description FROM fonds_entries WHERE description LIKE '%REPORT 2025%'`,
    ])
 
    return NextResponse.json({
      coffre_entries_total: coffreCount[0]?.n,
      fonds_entries_total: fondsCount[0]?.n,
      coffre_entries_administrateur: coffreAdminCount[0]?.n,
      fonds_entries_administrateur: fondsAdminCount[0]?.n,
      coffre_derniers_ajouts: coffreSample,
      fonds_derniers_ajouts: fondsSample,
      coffre_ligne_report_2025: coffreFirst,
      fonds_ligne_report_2025: fondsFirstReport,
    })
  } catch (error) {
    console.error('Debug coffre/fonds error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
 
