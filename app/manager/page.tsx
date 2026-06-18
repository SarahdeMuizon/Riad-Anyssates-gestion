'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Entry, Employee, DashboardStats } from '@/types'

type Tab = 'dashboard' | 'cb' | 'cash' | 'employees' | 'settings'

export default function ManagerPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    fetch('/api/auth/check').then(r => {
      if (!r.ok) router.replace('/')
      else setAuthChecked(true)
    })
  }, [router])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.replace('/')
  }

  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: 'var(--terracotta)' }}>Chargement…</div>
    </div>
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '📊 Tableau de bord' },
    { id: 'cb', label: '💳 Dépenses' },
    { id: 'cash', label: '💵 Encaissements' },
    { id: 'employees', label: '👥 Employés' },
    { id: 'settings', label: '⚙️ Paramètres' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--terracotta)',
        color: 'white',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏨 Riad Anyssates</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Manager</span>
          <button
            onClick={logout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ whiteSpace: 'nowrap', padding: '0.75rem 0.875rem', borderRadius: 0, borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent', background: 'transparent', color: tab === t.id ? 'var(--terracotta)' : 'var(--text)', fontWeight: tab === t.id ? 700 : 500 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'cb' && <EntriesTab type="cb" />}
        {tab === 'cash' && <EntriesTab type="cash" />}
        {tab === 'employees' && <EmployeesTab />}
        {tab === 'settings' && <SettingsTab onLogout={logout} />}
      </main>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p>Chargement…</p>
  if (!stats) return <p>Erreur de chargement.</p>

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--terracotta)' }}>Tableau de bord</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Dépenses CB</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--terracotta)' }}>{stats.total_cb.toFixed(2)} €</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Encaissements</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--green)' }}>{stats.total_cash.toFixed(2)} €</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
          <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>En attente</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706' }}>{stats.pending_count}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Validés</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--blue)' }}>{stats.validated_count}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {stats.cb_by_category.length > 0 && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--terracotta)' }}>💳 Dépenses par catégorie</h3>
            {stats.cb_by_category.map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F5EDE4', fontSize: '0.9rem' }}>
                <span>{c.category}</span>
                <span style={{ fontWeight: 600 }}>{c.total.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}
        {stats.cash_by_category.length > 0 && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--green)' }}>💵 Encaissements par catégorie</h3>
            {stats.cash_by_category.map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #EDF7F1', fontSize: '0.9rem' }}>
                <span>{c.category}</span>
                <span style={{ fontWeight: 600, color: 'var(--green)' }}>{c.total.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Entries Tab ───────────────────────────────────────────────────────────────

function EntriesTab({ type }: { type: 'cb' | 'cash' }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [employees, setEmployees] = useState<string[]>([])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ type })
    if (filterStatus) params.set('status', filterStatus)
    if (filterEmployee) params.set('employee', filterEmployee)
    const r = await fetch(`/api/entries?${params}`)
    const data = await r.json()
    setEntries(data)
    setLoading(false)
  }, [type, filterStatus, filterEmployee])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      setEmployees(emps.filter(e => e.active).map(e => e.name))
    })
  }, [])

  async function toggleStatus(entry: Entry) {
    const newStatus = entry.status === 'pending' ? 'validated' : 'pending'
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchEntries()
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
  }

  function exportCSV() {
    window.location.href = `/api/export/${type}`
  }

  const total = entries.reduce((s, e) => s + Number(e.amount), 0)
  const title = type === 'cb' ? '💳 Dépenses (CB)' : '💵 Encaissements (Cash)'
  const accentColor = type === 'cb' ? 'var(--terracotta)' : 'var(--green)'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: accentColor }}>{title}</h2>
        <button className="btn-secondary" onClick={exportCSV} style={{ fontSize: '0.85rem' }}>
          ⬇️ Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="validated">Validés</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
          <option value="">Tous les employés</option>
          {employees.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: accentColor }}>
          Total : {total.toFixed(2)} €
        </span>
      </div>

      {loading ? <p>Chargement…</p> : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucune entrée</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employé</th>
                <th>Catégorie</th>
                {type === 'cb' && <th>Fournisseur</th>}
                {type === 'cb' && <th>Paiement</th>}
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td>{e.employee_name}</td>
                  <td>{e.category}</td>
                  {type === 'cb' && <td>{e.supplier || '—'}</td>}
                  {type === 'cb' && <td>{e.payment || '—'}</td>}
                  <td style={{ fontWeight: 600, color: accentColor }}>{Number(e.amount).toFixed(2)} €</td>
                  <td>
                    <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>
                      {e.status === 'validated' ? 'Validé' : 'En attente'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => toggleStatus(e)}
                      style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      {e.status === 'pending' ? '✓' : '↩'}
                    </button>
                    <button
                      onClick={() => setDeleteModal(e.id)}
                      style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Supprimer cette entrée ?</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.25rem' }}>Cette action est irréversible.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal(null)}>Annuler</button>
              <button className="btn-red" onClick={() => deleteEntry(deleteModal)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [poste, setPoste] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const fetchEmployees = useCallback(async () => {
    const r = await fetch('/api/employees')
    const data = await r.json()
    setEmployees(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), poste: poste.trim() || 'Employé' }),
    })
    setName('')
    setPoste('')
    setShowForm(false)
    setAdding(false)
    fetchEmployees()
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !emp.active }),
    })
    fetchEmployees()
  }

  function getLink(token: string) {
    return `${window.location.origin}/employee?emp=${token}`
  }

  function copyLink(emp: Employee) {
    navigator.clipboard.writeText(getLink(emp.token))
    setCopiedId(emp.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--terracotta)' }}>👥 Employés</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={addEmployee} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom *</label>
              <input className="form-input" style={{ width: 180 }} value={name} onChange={e => setName(e.target.value)} placeholder="Prénom Nom" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Poste</label>
              <input className="form-input" style={{ width: 180 }} value={poste} onChange={e => setPoste(e.target.value)} placeholder="Employé" />
            </div>
            <button className="btn-primary" type="submit" disabled={adding}>
              {adding ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </div>
      )}

      {loading ? <p>Chargement…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {employees.map(emp => (
            <div key={emp.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', opacity: emp.active ? 1 : 0.55 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{emp.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{emp.poste}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {emp.active && (
                  <button
                    onClick={() => copyLink(emp)}
                    style={{ background: '#EEF2FF', color: 'var(--blue)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    {copiedId === emp.id ? '✓ Copié' : '🔗 Copier lien'}
                  </button>
                )}
                <button
                  onClick={() => toggleActive(emp)}
                  style={{ background: emp.active ? '#FEE2E2' : '#D1FAE5', color: emp.active ? 'var(--red)' : 'var(--green)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {emp.active ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun employé</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ onLogout }: { onLogout: () => void }) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [pinError, setPinError] = useState('')
  const [resetModal, setResetModal] = useState(false)

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinMsg('')
    setPinError('')
    if (newPin !== confirmPin) {
      setPinError('Les nouveaux PINs ne correspondent pas.')
      return
    }
    if (newPin.length < 4) {
      setPinError('Le PIN doit faire au moins 4 caractères.')
      return
    }
    const r = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
    })
    if (r.ok) {
      setPinMsg('PIN modifié avec succès.')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } else {
      const d = await r.json()
      setPinError(d.error || 'Erreur.')
    }
  }

  async function resetAll() {
    await fetch('/api/settings/reset', { method: 'DELETE' })
    setResetModal(false)
    onLogout()
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--terracotta)' }}>⚙️ Paramètres</h2>

      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Changer le PIN</h3>
        <form onSubmit={changePin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>PIN actuel</label>
            <input className="form-input" type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nouveau PIN</label>
            <input className="form-input" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Confirmer le nouveau PIN</label>
            <input className="form-input" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} required />
          </div>
          {pinError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{pinError}</p>}
          {pinMsg && <p style={{ color: 'var(--green)', fontSize: '0.875rem' }}>{pinMsg}</p>}
          <button className="btn-primary" type="submit">Enregistrer</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 420, borderLeft: '4px solid var(--red)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red)' }}>Zone dangereuse</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>
          Réinitialiser supprime toutes les données (entrées, employés) et remet le PIN par défaut.
        </p>
        <button
          style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => setResetModal(true)}
        >
          Réinitialiser toutes les données
        </button>
      </div>

      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>⚠️ Réinitialisation</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>
              Toutes les données seront supprimées. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setResetModal(false)}>Annuler</button>
              <button className="btn-red" onClick={resetAll}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
