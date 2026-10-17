import sql from '@/lib/db'
import { DEFAULT_TAXE_SEJOUR, mergeTva, type TvaRates } from '@/lib/invoice'

// Tarif de la taxe de séjour (MAD / personne / nuit), modifiable dans l'onglet Comptable
export async function getTaxeSejourRate(): Promise<number> {
  const rows = await sql`SELECT value FROM settings WHERE key = 'taxe_sejour_mad'`
  const v = parseFloat((rows[0]?.value as string) ?? '')
  return isNaN(v) ? DEFAULT_TAXE_SEJOUR : v
}

// Retire une facture faite par erreur. La dernière facture de l'année est supprimée (son numéro
// sera réutilisé) ; une plus ancienne est annulée : son numéro reste pour que la numérotation
// soit continue, mais elle ne compte plus dans la taxe de séjour ni dans l'onglet Comptable.
export async function removeInvoice(id: number): Promise<'deleted' | 'cancelled' | null> {
  const inv = (await sql`SELECT id, year, seq FROM invoices WHERE id = ${id}`)[0]
  if (!inv) return null
  const last = await sql`SELECT MAX(seq) AS m FROM invoices WHERE year = ${inv.year}`
  if (Number(last[0]?.m) === Number(inv.seq)) {
    await sql`DELETE FROM invoices WHERE id = ${id}`
    return 'deleted'
  }
  await sql`UPDATE invoices SET cancelled = 1, entry_id = NULL WHERE id = ${id}`
  return 'cancelled'
}

// Factures restées sans encaissement (encaissement supprimé avant que la facture soit retirée) :
// elles sont supprimées ou annulées comme une facture faite par erreur, pour que leur taxe de
// séjour ne compte plus. Les plus récentes d'abord, pour garder la numérotation continue.
export async function cleanupOrphanInvoices() {
  const rows = await sql`
    SELECT i.id FROM invoices i
    WHERE COALESCE(i.cancelled, 0) = 0
      AND (i.entry_id IS NULL OR NOT EXISTS (SELECT 1 FROM entries e WHERE e.id = i.entry_id))
    ORDER BY i.year DESC, i.seq DESC`
  for (const r of rows) await removeInvoice(r.id as number)
}

// Taux de TVA par catégorie de prestation
export async function getTvaRates(): Promise<TvaRates> {
  const rows = await sql`SELECT value FROM settings WHERE key = 'tva_rates'`
  try { return mergeTva(JSON.parse((rows[0]?.value as string) || '{}')) } catch { return mergeTva(null) }
}
