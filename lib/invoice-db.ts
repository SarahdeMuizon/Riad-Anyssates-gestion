import sql from '@/lib/db'
import { DEFAULT_TAXE_SEJOUR } from '@/lib/invoice'

// Tarif de la taxe de séjour (MAD / personne / nuit), modifiable dans l'onglet Comptable
export async function getTaxeSejourRate(): Promise<number> {
  const rows = await sql`SELECT value FROM settings WHERE key = 'taxe_sejour_tarif'`
  const v = parseFloat((rows[0]?.value as string) ?? '')
  return isNaN(v) ? DEFAULT_TAXE_SEJOUR : v
}
