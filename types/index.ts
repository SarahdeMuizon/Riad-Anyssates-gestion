export type EntryType = 'cb' | 'cash'
export type FondsDirection = 'in' | 'out'
export type EntryStatus = 'pending' | 'validated'
 
export interface Entry {
  id: number
  employee_name: string
  type: EntryType
  date: string
  amount: number
  currency: string
  category: string
  supplier?: string
  payment?: string
  description?: string
  invoice_url?: string
  amount_ht?: number
  tva_rate?: number
  status: EntryStatus
  validated_at?: string
  pointed?: boolean | number
  created_at: string
}
 
export interface FondsEntry {
  id: number
  employee_name: string
  direction: FondsDirection
  date: string
  amount: number
  currency: string
  category: string
  description?: string
  status: EntryStatus
  validated_at?: string
  created_at: string
}
 
export interface Employee {
  id: number
  name: string
  poste: string
  token: string
  active: boolean
  created_at: string
}
 
export interface DashboardStats {
  total_depenses: number
  total_encaissements: number
  total_fonds_in: number
  total_fonds_out: number
  pending_count: number
  validated_count: number
  depenses_by_category: { category: string; total: number }[]
  encaissements_by_category: { category: string; total: number }[]
  month: string
}
 
export const DEPENSES_CATEGORIES = [
  'Alimentation/Courses',
  'Fournitures & bureautique',
  'Entretien & maintenance',
  'Transport',
  'Restauration',
  'Pharmacie/Hygiène',
  'Décoration & fleurs',
  'Autre',
]
 
export const ENCAISSEMENTS_CATEGORIES = [
  'Boissons bar',
  'Repas/Restauration',
  'Activité/Excursion',
  'Service spa/Hammam',
  'Transfert/Transport',
  'Pourboire collectif',
  'Autre encaissement',
]
 
export const FONDS_CATEGORIES = [
  'Courses/Marché',
  'Entretien',
  'Personnel',
  'Transport',
  'Pourboire',
  'Recette cash',
  'Remboursement',
  'Autre',
]
 
export const PAYMENT_MODES = ['CB', 'Virement', 'Chèque']
 
export const CURRENCIES: string[] = ['MAD', 'EUR']
 
// Backwards compat aliases
export const CB_CATEGORIES = DEPENSES_CATEGORIES
export const CASH_CATEGORIES = ENCAISSEMENTS_CATEGORIES
 
