// Factures de vente (encaissements clients) et taxe de séjour.
// Partagé entre le serveur (calcul officiel enregistré en base) et le navigateur
// (aperçu en direct dans le formulaire), pour que les deux donnent le même résultat.
//
// Une facture est toujours en dirhams. Le client paie un montant global (l'encaissement) ;
// la taxe de séjour (28 MAD / personne / nuit) en est déduite, ainsi que les éventuelles
// lignes Boissons, Spa, Transport… ; le reste correspond à l'hébergement.

export interface Invoice {
  id: number
  number: string          // ex : FA-2026-0001
  year: number
  seq: number
  entry_id: number | null
  date: string            // date de la facture (AAAA-MM-JJ) — sert aussi au trimestre de la taxe de séjour
  client_name: string | null
  description: string | null
  lines: string | null    // JSON InvoiceLine[] — prestations facturées (TTC)
  nights: number
  persons: number
  tax_rate: number        // taxe de séjour, par personne et par nuit
  tax_amount: number
  tax_currency: string    // MAD (les toutes premières factures de test pouvaient être en EUR)
  tax_included: number
  tva_rate: number        // ancien champ (TVA unique), remplacé par la TVA de chaque ligne
  amount_lodging: number  // total des prestations TTC (hors taxe de séjour)
  amount_total: number    // total de la facture = montant payé par le client
  currency: string
  payment: string | null
  cancelled?: number      // 1 = facture annulée (faite par erreur)
  created_at: string
}

export interface InvoiceLine { label: string; amount: number; tva: number } // amount TTC en MAD, tva en %

export const DEFAULT_TAXE_SEJOUR = 28 // MAD par personne et par nuit

// Catégories de prestations et leur taux de TVA (%) — à compléter avec les taux du comptable
export const INVOICE_CATEGORIES: { label: string; tva: number }[] = [
  { label: 'Hébergement', tva: 0 },
  { label: 'Boissons', tva: 0 },
  { label: 'Spa', tva: 0 },
  { label: 'Transport', tva: 0 },
  { label: 'Divers', tva: 0 },
]
export const LODGING = 'Hébergement'
export const EXTRA_CATEGORIES = INVOICE_CATEGORIES.filter(c => c.label !== LODGING).map(c => c.label)
export const tvaOf = (label: string) => INVOICE_CATEGORIES.find(c => c.label === label)?.tva ?? 0

export interface InvoiceInput {
  gross: number                                     // montant payé par le client, en MAD
  nights: number
  persons: number
  taxRate: number
  extras: { label: string; amount: number }[]       // lignes autres que l'hébergement
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeInvoice(i: InvoiceInput) {
  const nights = Math.max(0, Math.floor(i.nights || 0))
  const persons = Math.max(0, Math.floor(i.persons || 0))
  const taxAmount = r2(nights * persons * (i.taxRate || 0))
  const extras = i.extras
    .map(e => ({ label: EXTRA_CATEGORIES.includes(e.label) ? e.label : 'Divers', amount: r2(Number(e.amount) || 0) }))
    .filter(e => e.amount > 0)
  const lodging = r2((i.gross || 0) - taxAmount - extras.reduce((s, e) => s + e.amount, 0))
  const lines: InvoiceLine[] = [
    ...(lodging > 0 ? [{ label: LODGING, amount: lodging, tva: tvaOf(LODGING) }] : []),
    ...extras.map(e => ({ ...e, tva: tvaOf(e.label) })),
  ]
  return { nights, persons, taxAmount, lodging, lines, ...lineTotals(lines), total: r2(i.gross || 0), valid: lodging >= 0 && (i.gross || 0) > 0 }
}

export function lineTotals(lines: InvoiceLine[]) {
  let ht = 0, tva = 0
  for (const l of lines) {
    const h = l.tva > 0 ? r2(l.amount / (1 + l.tva / 100)) : l.amount
    ht += h; tva += l.amount - h
  }
  return { totalHT: r2(ht), totalTVA: r2(tva), prestations: r2(lines.reduce((s, l) => s + l.amount, 0)) }
}

// Lignes envoyées par le formulaire (requête API)
export function parseExtras(v: unknown): { label: string; amount: number }[] {
  return Array.isArray(v) ? v.slice(0, 20).map(e => ({ label: String(e?.label ?? ''), amount: Number(e?.amount) || 0 })) : []
}

// Lignes d'une facture enregistrée (les premières factures n'avaient qu'une ligne)
export function invoiceLines(inv: Invoice): InvoiceLine[] {
  if (inv.lines) {
    try { return JSON.parse(inv.lines) as InvoiceLine[] } catch { /* ancienne facture */ }
  }
  return [{ label: inv.description || LODGING, amount: Number(inv.amount_lodging), tva: Number(inv.tva_rate) || 0 }]
}

// Lignes autres que l'hébergement, pour rouvrir une facture en modification
export function invoiceExtras(inv: Invoice) {
  return invoiceLines(inv).filter(l => l.label !== LODGING).map(l => ({ label: l.label, amount: l.amount }))
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
