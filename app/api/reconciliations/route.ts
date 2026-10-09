import { NextRequest, NextResponse } from 'next/server'
import sql, { ensureDb } from '@/lib/db'
import { getManagerSession, getManagerName } from '@/lib/auth'
import { getCashBalance } from '@/lib/cash'
import { notify, fmtAmount } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// GET (administrateurs) : derniers rapprochements enregistrés
export async function GET() {
  try {
    await ensureDb()
    if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const rows = await sql`SELECT * FROM cash_reconciliations ORDER BY id DESC LIMIT 30`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET reconciliations error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST : enregistre un rapprochement de caisse (comptage physique) et prévient les administrateurs
export async function POST(req: NextRequest) {
  try {
    await ensureDb()
    const body = await req.json()
    const { token } = body
    let who: string
    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      who = emp[0].name as string
    } else {
      if (!(await getManagerSession())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      who = getManagerName()
    }
    const num = (v: unknown) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
    const countedMad = num(body.counted_mad)
    const countedEur = num(body.counted_eur)
    if (countedMad === null && countedEur === null) return NextResponse.json({ error: 'Saisissez au moins un montant compté' }, { status: 400 })

    const expected = await getCashBalance()
    const row = await sql`
      INSERT INTO cash_reconciliations (employee_name, counted_mad, counted_eur, expected_mad, expected_eur)
      VALUES (${who}, ${countedMad}, ${countedEur}, ${expected.mad}, ${expected.eur})
      RETURNING *
    `

    const parts: string[] = []
    let allOk = true
    for (const [cur, counted, exp] of [['MAD', countedMad, expected.mad], ['EUR', countedEur, expected.eur]] as const) {
      if (counted === null) continue
      const diff = Math.round((counted - exp) * 100) / 100
      if (Math.abs(diff) >= 0.01) allOk = false
      parts.push(`${fmtAmount(counted, cur)} compté${Math.abs(diff) < 0.01 ? ' ✓' : ` (écart ${diff > 0 ? '+' : ''}${fmtAmount(diff, cur)})`}`)
    }
    await notify({
      kind: 'rapprochement',
      actor: who,
      title: `${who} : rapprochement de caisse ${allOk ? '✓ juste' : '⚠️ écart'}`,
      body: parts.join(' · '),
      url: '/manager',
    })
    return NextResponse.json({ ...row[0], ok: allOk }, { status: 201 })
  } catch (error) {
    console.error('POST reconciliation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
