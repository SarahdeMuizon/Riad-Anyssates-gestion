import sql from '@/lib/db'

// Solde commun du fond de caisse, par devise :
// espèces encaissées − espèces dépensées passées par la caisse (hors coffre) + mouvements propres à la caisse.
export async function getCashBalance(): Promise<{ mad: number; eur: number }> {
  const entries = await sql`
    SELECT COALESCE(currency, 'MAD') AS cur,
           SUM(CASE WHEN type = 'cash' THEN amount ELSE -amount END) AS total
    FROM entries
    WHERE payment = 'Espèces' AND COALESCE(cash_location, 'fonds') <> 'coffre'
    GROUP BY COALESCE(currency, 'MAD')
  `
  const fonds = await sql`
    SELECT COALESCE(currency, 'MAD') AS cur,
           SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) AS total
    FROM fonds_entries
    GROUP BY COALESCE(currency, 'MAD')
  `
  const bal: Record<string, number> = { MAD: 0, EUR: 0 }
  for (const r of [...entries, ...fonds]) {
    const cur = r.cur === 'EUR' ? 'EUR' : 'MAD'
    bal[cur] += Number(r.total) || 0
  }
  return { mad: Math.round(bal.MAD * 100) / 100, eur: Math.round(bal.EUR * 100) / 100 }
}
