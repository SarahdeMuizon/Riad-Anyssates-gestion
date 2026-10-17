import sql from '@/lib/db'
import { DEFAULT_TAXE_SEJOUR, DEFAULT_TAXE_DEVISE } from '@/lib/invoice'

// Tarif de la taxe de séjour (par personne et par nuit) et sa devise, modifiables dans l'onglet Comptable
export async function getTaxeSejour(): Promise<{ rate: number; currency: string }> {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('taxe_sejour_tarif', 'taxe_sejour_devise')`
  const get = (k: string) => rows.find(r => r.key === k)?.value as string | undefined
  const v = parseFloat(get('taxe_sejour_tarif') ?? '')
  const cur = get('taxe_sejour_devise')
  return { rate: isNaN(v) ? DEFAULT_TAXE_SEJOUR : v, currency: cur === 'MAD' || cur === 'EUR' ? cur : DEFAULT_TAXE_DEVISE }
}
