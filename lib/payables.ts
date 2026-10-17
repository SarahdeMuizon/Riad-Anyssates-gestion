// Factures fournisseurs à payer : fournisseurs habituels, catégorie de dépense proposée
// et mode de facturation :
//  - 'mensuel' : une facture par mois (NDT, Renaisens)
//  - 'bons'    : un bon à chaque commande, puis une facture de fin de mois à rapprocher des bons (Elite Food, Berghout)
export type SupplierMode = 'mensuel' | 'bons'

export const PAYABLE_SUPPLIERS: { name: string; category: string; mode: SupplierMode }[] = [
  { name: 'NDT', category: 'Prestataire', mode: 'mensuel' },
  { name: 'Renaisens', category: 'Spa', mode: 'mensuel' },
  { name: 'Elite Food', category: 'Nourriture', mode: 'bons' },
  { name: 'Berghout', category: 'Prestataire', mode: 'bons' },
]
// Fournisseur libre (artisans, ponctuels…)
export const PAYABLE_OTHER_CATEGORY = 'Travaux'

export function payableCategory(supplier: string) {
  return PAYABLE_SUPPLIERS.find(s => s.name === supplier)?.category ?? PAYABLE_OTHER_CATEGORY
}

export function supplierMode(supplier: string): SupplierMode | null {
  return PAYABLE_SUPPLIERS.find(s => s.name === supplier)?.mode ?? null
}

export interface Payable {
  id: number
  kind: 'facture' | 'bon'
  supplier: string
  category: string | null
  date: string
  period: string | null
  reference: string | null
  description: string | null
  notes: string | null
  amount: number
  currency: string
  due_date: string | null
  filename: string | null
  has_file: number
  status: 'todo' | 'paid'
  paid_date: string | null
  payment: string | null
  entry_id: number | null
  invoice_id: number | null
  created_by: string | null
  payments: { id: number; date: string; amount: number; payment: string | null }[]
}
