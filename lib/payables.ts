// Factures fournisseurs à payer : fournisseurs habituels et catégorie de dépense proposée
export const PAYABLE_SUPPLIERS: { name: string; category: string }[] = [
  { name: 'NDT', category: 'Prestataire' },
  { name: 'Renaisens', category: 'Spa' },
  { name: 'Berghout', category: 'Prestataire' },
  { name: 'Elite Food', category: 'Nourriture' },
]
// Fournisseur libre (artisans, ponctuels…)
export const PAYABLE_OTHER_CATEGORY = 'Travaux'

export function payableCategory(supplier: string) {
  return PAYABLE_SUPPLIERS.find(s => s.name === supplier)?.category ?? PAYABLE_OTHER_CATEGORY
}

export interface Payable {
  id: number
  supplier: string
  category: string | null
  date: string
  reference: string | null
  description: string | null
  amount: number
  currency: string
  due_date: string | null
  filename: string | null
  has_file: number
  status: 'todo' | 'paid'
  paid_date: string | null
  payment: string | null
  entry_id: number | null
  created_by: string | null
}
