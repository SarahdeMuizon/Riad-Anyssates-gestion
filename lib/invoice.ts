// Factures de vente (encaissements clients) et taxe de séjour.
// Partagé entre le serveur (calcul officiel enregistré en base) et le navigateur
// (aperçu en direct dans le formulaire), pour que les deux donnent le même résultat.

export interface Invoice {
  id: number
  number: string          // ex : FA-2026-0001
  year: number
  seq: number
  entry_id: number | null
  date: string            // date de la facture (AAAA-MM-JJ) — sert aussi au trimestre de la taxe de séjour
  client_name: string | null
  description: string | null
  nights: number
  persons: number
  tax_rate: number        // taxe de séjour, en MAD par personne et par nuit
  tax_amount: number      // en MAD
  tax_included: number    // 1 = la taxe est comprise dans le montant encaissé
  tva_rate: number        // TVA (%) appliquée à la prestation, 0 = pas de TVA
  amount_lodging: number  // prestation TTC (hors taxe de séjour)
  amount_total: number    // total de la facture
  currency: string
  payment: string | null
  created_at: string
}

export const DEFAULT_TAXE_SEJOUR = 25 // MAD / personne / nuit

export interface InvoiceInput {
  gross: number          // montant payé par le client (transaction CB brute, ou montant encaissé)
  currency: string
  nights: number
  persons: number
  taxRate: number
  taxIncluded: boolean
  tvaRate: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeInvoice(i: InvoiceInput) {
  const nights = Math.max(0, Math.floor(i.nights || 0))
  const persons = Math.max(0, Math.floor(i.persons || 0))
  const taxAmount = r2(nights * persons * (i.taxRate || 0))
  // La taxe de séjour est en MAD : on ne peut l'ajouter / la déduire que d'un montant en MAD.
  const mixable = (i.currency || 'MAD') === 'MAD'
  const taxIncluded = mixable && i.taxIncluded
  const lodging = r2(taxIncluded ? i.gross - taxAmount : i.gross)
  const total = r2(mixable && !taxIncluded ? i.gross + taxAmount : i.gross)
  const tva = i.tvaRate > 0 ? r2(lodging - lodging / (1 + i.tvaRate / 100)) : 0
  return { nights, persons, taxAmount, taxIncluded, mixable, lodging, lodgingHT: r2(lodging - tva), tva, total }
}

// Montant réellement payé par le client pour un encaissement :
// pour une carte bancaire, l'encaissement est enregistré net de commission,
// le montant de la transaction est conservé dans amount_ht.
export function entryGross(e: { amount: number; amount_ht?: number | null; payment?: string | null }): number {
  if (e.payment === 'CB' && e.amount_ht) return Number(e.amount_ht)
  return Number(e.amount)
}

export function quarterOf(date: string): number {
  return Math.floor((parseInt(date.substring(5, 7), 10) - 1) / 3) + 1
}

export const QUARTER_LABELS = ['', '1er trimestre (janv. – mars)', '2e trimestre (avr. – juin)', '3e trimestre (juil. – sept.)', '4e trimestre (oct. – déc.)']
