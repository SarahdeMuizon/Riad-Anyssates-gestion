'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Entry } from '@/types'
import { Suspense } from 'react'

const CB_CATEGORIES = ['Alimentation/Courses','Fournitures & bureautique','Entretien & maintenance','Transport','Restauration','Pharmacie/Hygiène','Décoration & fleurs','Autre']
const CASH_CATEGORIES = ['Boissons bar','Repas/Restauration','Activité/Excursion','Service spa/Hammam','Transfert/Transport','Pourboire collectif','Autre encaissement']
const PAYMENT_MODES = ['Espèces','Carte bancaire','Virement','Autre']

type Tab = 'cb' | 'cash' | 'history'

interface EmployeeInfo {
  id: number
  name: string
  poste: string
}

function EmployeeApp() {
  const searchParams = useSearchParams()
  const token = searchParams.get('emp')

  const [employee, setEmployee] = useState<EmployeeInfo | null>(null)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<Tab>('cb')

  useEffect(() => {
    if (!token) { setAuthError('Lien invalide.'); return }
    fetch(`/api/employees/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setAuthError(data.error)
        else setEmployee(data)
      })
      .catch(() => setAuthError('Erreur de connexion.'))
  }, [token])

  if (authError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <p style={{ color: 'var(--red)', fontWeight: 600 }}>{authError}</p>
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>Contactez votre manager pour obtenir votre lien.</p>
      </div>
    </div>
  )

  if (!employee) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--terracotta)' }}>Chargement…</div>
    </div>
  )

  const tabs = [
    { id: 'cb' as Tab, label: '💳 Dépense CB' },
    { id: 'cash' as Tab, label: '💵 Encaissement' },
    { id: 'history' as Tab, label: '📋 Mon historique' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--terracotta)',
        color: 'white',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ fontWeight: 700 }}>🏨 Riad Anyssates</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{employee.name}</div>
      </header>

      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.75rem 0.875rem',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.id ? 'var(--terracotta)' : 'var(--text)',
              fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
        {tab === 'cb' && <EmployeeForm type="cb" token={token!} employeeName={employee.name} />}
        {tab === 'cash' && <EmployeeForm type="cash" token={token!} employeeName={employee.name} />}
        {tab === 'history' && <EmployeeHistory token={token!} />}
      </main>
    </div>
  )
}

function EmployeeForm({ type, token, employeeName }: { type: 'cb' | 'cash'; token: string; employeeName: string }) {
  const categories = type === 'cb' ? CB_CATEGORIES : CASH_CATEGORIES
  const accentColor = type === 'cb' ? 'var(--terracotta)' : 'var(--green)'
  const title = type === 'cb' ? '💳 Nouvelle dépense CB' : '💵 Nouvel encaissement'

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [supplier, setSupplier] = useState('')
  const [payment, setPayment] = useState(PAYMENT_MODES[0])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const r = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date, amount: parseFloat(amount), category, supplier, payment, description, token }),
      })
      if (r.ok) {
        setSuccess('Enregistré avec succès !')
        setAmount('')
        setSupplier('')
        setDescription('')
        setCategory(categories[0])
        setPayment(PAYMENT_MODES[0])
        setDate(new Date().toISOString().split('T')[0])
      } else {
        const d = await r.json()
        setError(d.error || 'Erreur.')
      }
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: accentColor }}>{title}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant (€) *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {type === 'cb' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fournisseur / Lieu</label>
              <input className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nom du fournisseur" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de paiement</label>
              <select className="form-input" value={payment} onChange={e => setPayment(e.target.value)}>
                {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600 }}>{success}</p>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ background: accentColor }}>
          {submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}

function EmployeeHistory({ token }: { token: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    const r = await fetch(`/api/entries?token=${token}`)
    const data = await r.json()
    setEntries(data)
    setLoading(false)
  }, [token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (loading) return <p>Chargement…</p>

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--terracotta)' }}>📋 Mon historique</h2>
      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucune entrée pour le moment.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {entries.map(e => (
            <div key={e.id} className="card" style={{ borderLeft: `4px solid ${e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)', textTransform: 'uppercase' }}>
                    {e.type === 'cb' ? 'CB' : 'Cash'}
                  </span>
                  <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{e.category}</div>
                  {e.supplier && <div style={{ fontSize: '0.8rem', color: '#888' }}>{e.supplier}</div>}
                  {e.description && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>{e.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)' }}>
                    {Number(e.amount).toFixed(2)} €
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </div>
                  <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'} style={{ display: 'inline-block', marginTop: '0.25rem' }}>
                    {e.status === 'validated' ? 'Validé' : 'En attente'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EmployeePage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Chargement…</div>}>
      <EmployeeApp />
    </Suspense>
  )
}
