export type EntryType = 'cb' | 'cash'
export type EntryStatus = 'pending' | 'validated'

export interface Entry {
  id: number
  employee_name: string
  type: EntryType
  date: string
  amount: number
  category: string
  supplier?: string
  payment?: string
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
  total_cb: number
  total_cash: number
  pending_count: number
  validated_count: number
  cb_by_category: { category: string; total: number }[]
  cash_by_category: { category: string; total: number }[]
}

export const CB_CATEGORIES = [
  'Alimentation/Courses',
  'Fournitures & bureautique',
  'Entretien & maintenance',
  'Transport',
  'Restauration',
  'Pharmacie/Hygiène',
  'Décoration & fleurs',
  'Autre',
]

export const CASH_CATEGORIES = [
  'Boissons bar',
  'Repas/Restauration',
  'Activité/Excursion',
  'Service spa/Hammam',
  'Transfert/Transport',
  'Pourboire collectif',
  'Autre encaissement',
]

export const PAYMENT_MODES = [
  'Espèces',
  'Carte bancaire',
  'Virement',
  'Autre',
]
