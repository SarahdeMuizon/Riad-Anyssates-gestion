'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Entry, Employee, DashboardStats, FondsEntry } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

type Tab = 'dashboard' | 'depenses' | 'encaissements' | 'fonds' | 'coffre' | 'employees' | 'settings'

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatMonth(month: string) {
  const [y, m] = month.split('-')
  const names = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  return `${names[parseInt(m) - 1]} ${y}`
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'depenses', label: '💳 Dépenses' },
    { id: 'encaissements', label: '💵 Encaissements' },
    { id: 'fonds', label: '💰 Fond de caisse' },
    { id: 'coffre', label: '🔐 Coffre fort' },
    { id: 'employees', label: '👥 Employés' },
    { id: 'settings', label: '⚙️ Paramètres' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--terracotta)', color: 'white', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏨 Riad Anyssates</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => window.location.href = '/api/export/excel'} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>📊 Excel</button>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Manager</span>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>Déconnexion</button>
        </div>
      </header>

      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ whiteSpace: 'nowrap', padding: '0.75rem 0.875rem', border: 'none', borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent', background: 'transparent', color: tab === t.id ? 'var(--terracotta)' : 'var(--text)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      <main style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'depenses' && <EntriesTab type="cb" label="Dépenses" color="var(--terracotta)" />}
        {tab === 'encaissements' && <EntriesTab type="cash" label="Encaissements" color="var(--green)" />}
        {tab === 'fonds' && <FondsTab />}
        {tab === 'coffre' && <CoffreTab />}
        {tab === 'employees' && <EmployeesTab />}
        {tab === 'settings' && <SettingsTab onLogout={logout} />}
      </main>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

const PIE_COLORS_DEP = ['#D97D4E','#E8956A','#F0A978','#F5BC90','#F8CFAA','#FADBB8','#FCE7CC','#FEF3E4']
const PIE_COLORS_ENC = ['#2D9E6B','#45B882','#5DC898','#74D8AD','#8BE3BE','#A2EDCF','#B9F5E0','#D0FAF0']

type TrendRow = { month: string; depenses: number; encaissements: number }

function DashboardTab() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch(`/api/dashboard?month=${month}`),
      fetch(`/api/dashboard/trend?month=${month}`),
    ])
    setStats(await r1.json())
    const t = await r2.json()
    setTrend(Array.isArray(t) ? t : [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchStats() }, [fetchStats])

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = month === currentMonthStr

  const fmtShort = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
  const shortMonth = (mo: string) => {
    const [, m] = mo.split('-')
    return ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(m) - 1]
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--terracotta)', minWidth: 180, textAlign: 'center' }}>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: isCurrentMonth ? 'default' : 'pointer', opacity: isCurrentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
        {!isCurrentMonth && (
          <button onClick={() => setMonth(currentMonthStr)} style={{ border: 'none', background: 'var(--terracotta)', color: 'white', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}>Mois actuel</button>
        )}
      </div>

      {loading ? <p>Chargement…</p> : !stats ? <p>Erreur.</p> : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Dépenses</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--terracotta)' }}>{fmt(stats.total_depenses)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Total Encaissements</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--green)' }}>{fmt(stats.total_encaissements)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Fond de caisse — Entrées</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366F1' }}>{fmt(stats.total_fonds_in)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Fond de caisse — Sorties</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706' }}>{fmt(stats.total_fonds_out)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#94A3B8' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>En attente</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#64748B' }}>{stats.pending_count}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--blue)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Validés</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--blue)' }}>{stats.validated_count}</div>
            </div>
          </div>

          {/* Bar chart — 6-month trend */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>📈 Évolution sur 6 mois</h3>
            {mounted && trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend.map(r => ({ ...r, month: shortMonth(r.month) }))} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                  <Legend />
                  <Bar dataKey="depenses" name="Dépenses" fill="#D97D4E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="encaissements" name="Encaissements" fill="#2D9E6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune donnée sur cette période.</p>}
          </div>

          {/* Pie charts + tables side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--terracotta)' }}>💳 Dépenses par catégorie</h3>
              {mounted && stats.depenses_by_category.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.depenses_by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {stats.depenses_by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS_DEP[i % PIE_COLORS_DEP.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '0.5rem' }}>
                    {stats.depenses_by_category.map((c, i) => {
                      const pct = stats.total_depenses > 0 ? Math.round(c.total / stats.total_depenses * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #F5EDE4', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS_DEP[i % PIE_COLORS_DEP.length], display: 'inline-block' }} />
                            {c.category}
                          </span>
                          <span style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ color: '#888', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                            <span style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{fmt(c.total)}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune dépense ce mois.</p>}
            </div>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--green)' }}>💵 Encaissements par catégorie</h3>
              {mounted && stats.encaissements_by_category.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.encaissements_by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {stats.encaissements_by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS_ENC[i % PIE_COLORS_ENC.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmt(v) : String(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '0.5rem' }}>
                    {stats.encaissements_by_category.map((c, i) => {
                      const pct = stats.total_encaissements > 0 ? Math.round(c.total / stats.total_encaissements * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #EDF7F1', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS_ENC[i % PIE_COLORS_ENC.length], display: 'inline-block' }} />
                            {c.category}
                          </span>
                          <span style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ color: '#888', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                            <span style={{ fontWeight: 600, color: 'var(--green)', minWidth: 80, textAlign: 'right' }}>{fmt(c.total)}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucun encaissement ce mois.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Entries Tab ───────────────────────────────────────────────────────────────

const DEPENSES_CATEGORIES = ['Alimentation/Courses','Fournitures & bureautique','Entretien & maintenance','Transport','Restauration','Pharmacie/Hygiène','Décoration & fleurs','Autre']
const ENCAISSEMENTS_CATEGORIES = ['Boissons bar','Repas/Restauration','Activité/Excursion','Service spa/Hammam','Transfert/Transport','Pourboire collectif','Autre encaissement']
const PAYMENT_MODES = ['CB', 'Virement', 'Chèque']
const CURRENCIES = ['MAD', 'EUR']

function EntriesTab({ type, label, color }: { type: 'cb' | 'cash'; label: string; color: string }) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [employees, setEmployees] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [fDate, setFDate] = useState(now.toISOString().split('T')[0])
  const [fEmployee, setFEmployee] = useState('')
  const [fCategory, setFCategory] = useState(type === 'cb' ? DEPENSES_CATEGORIES[0] : ENCAISSEMENTS_CATEGORIES[0])
  const [fAmount, setFAmount] = useState('')
  const [fAmountHT, setFAmountHT] = useState('')
  const [fTvaRate, setFTvaRate] = useState('')
  const [fCurrency, setFCurrency] = useState('MAD')
  const [fSupplier, setFSupplier] = useState('')
  const [fPayment, setFPayment] = useState('CB')
  const [fDescription, setFDescription] = useState('')
  const [fFile, setFFile] = useState<File | null>(null)
  const [fFilePreview, setFFilePreview] = useState<string | null>(null)
  const [fUploading, setFUploading] = useState(false)
  const [fExtracting, setFExtracting] = useState(false)
  const [fExtracted, setFExtracted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [uploadingEntryId, setUploadingEntryId] = useState<number | null>(null)
  const rowFileRef = useRef<HTMLInputElement>(null)
  const fFileRef = useRef<HTMLInputElement>(null)
  const [pendingUploadEntry, setPendingUploadEntry] = useState<number | null>(null)

  const categories = type === 'cb' ? DEPENSES_CATEGORIES : ENCAISSEMENTS_CATEGORIES

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ type, month })
    if (filterStatus) params.set('status', filterStatus)
    if (filterEmployee) params.set('employee', filterEmployee)
    const r = await fetch(`/api/entries?${params}`)
    setEntries(await r.json())
    setLoading(false)
  }, [type, month, filterStatus, filterEmployee])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      const names = emps.filter(e => e.active).map(e => e.name)
      setEmployees(names)
      if (names.length > 0 && !fEmployee) setFEmployee(names[0])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset defaults every time form opens
  useEffect(() => {
    if (showForm) {
      setFCurrency('MAD')
      setFCategory(type === 'cb' ? DEPENSES_CATEGORIES[0] : ENCAISSEMENTS_CATEGORIES[0])
      setFPayment('CB')
      setFDate(new Date().toISOString().split('T')[0])
    }
  }, [showForm, type])

  async function toggleStatus(entry: Entry) {
    await fetch(`/api/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: entry.status === 'pending' ? 'validated' : 'pending' }) })
    fetchEntries()
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFFile(file)
    setFExtracted(false)
    if (file.type.startsWith('image/')) {
      setFFilePreview(URL.createObjectURL(file))
    } else {
      setFFilePreview(null)
    }
    setFExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const r = await fetch('/api/extract-invoice', { method: 'POST', body: fd })
      if (r.ok) {
        const data = await r.json()
        if (data.date) setFDate(data.date)
        if (data.supplier) setFSupplier(data.supplier)
        if (data.amount_ttc) setFAmount(String(data.amount_ttc))
        if (type === 'cb') {
          if (data.amount_ht) setFAmountHT(String(data.amount_ht))
          if (data.tva_rate) setFTvaRate(String(data.tva_rate))
        }
        setFExtracted(true)
      }
    } catch { /* silent */ }
    setFExtracting(false)
  }

  async function uploadToCloudinary(file: File, folder: string): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !preset) throw new Error('Cloudinary non configuré')
    const fd = new FormData()
    fd.append('file', file); fd.append('upload_preset', preset); fd.append('folder', folder)
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: fd })
    if (!r.ok) throw new Error('Erreur upload')
    return (await r.json()).secure_url as string
  }

  async function handleRowUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || pendingUploadEntry === null) return
    setUploadingEntryId(pendingUploadEntry)
    try {
      const folder = type === 'cb' ? 'riad-factures' : 'riad-tickets'
      const url = await uploadToCloudinary(file, folder)
      await fetch(`/api/entries/${pendingUploadEntry}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_url: url }) })
      fetchEntries()
    } catch { /* ignore */ }
    setUploadingEntryId(null)
    setPendingUploadEntry(null)
    if (rowFileRef.current) rowFileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    setFormSuccess('')
    let invoice_url: string | undefined
    if (fFile) {
      setFUploading(true)
      try {
        const folder = type === 'cb' ? 'riad-factures' : 'riad-tickets'
        invoice_url = await uploadToCloudinary(fFile, folder)
      } catch (err) { setFormError((err as Error).message); setFUploading(false); setSubmitting(false); return }
      setFUploading(false)
    }
    const body: Record<string, unknown> = { type, date: fDate, employee_name: fEmployee, category: fCategory, amount: parseFloat(fAmount), currency: fCurrency, description: fDescription || null, invoice_url }
    if (type === 'cb') {
      body.supplier = fSupplier || null
      body.payment = fPayment
      if (fAmountHT) body.amount_ht = parseFloat(fAmountHT)
      if (fTvaRate) body.tva_rate = parseFloat(fTvaRate)
    }
    try {
      const r = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        setFAmount(''); setFAmountHT(''); setFTvaRate(''); setFSupplier(''); setFDescription('')
        setFFile(null); setFFilePreview(null); setFExtracted(false); setShowForm(false)
        setFilterStatus(''); setFilterEmployee('')
        setFormSuccess('✓ Entrée ajoutée avec succès !')
        setTimeout(() => setFormSuccess(''), 4000)
        setMonth(fDate.substring(0, 7))
      } else {
        const d = await r.json().catch(() => ({}))
        setFormError(d.error || `Erreur serveur (${r.status})`)
      }
    } catch (err) {
      setFormError('Erreur de connexion — réessayez.')
    }
    setSubmitting(false)
  }

  function exportCSV() { window.location.href = `/api/export/${type}?month=${month}` }

  const total = entries.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{formatMonth(month)}</h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === currentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: month === currentMonth ? 'default' : 'pointer', opacity: month === currentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>

      {formSuccess && <p style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#F0FDF4', borderRadius: '0.4rem', border: '1px solid #86efac' }}>{formSuccess}</p>}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* Upload zone — identique page employé */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                {type === 'cb' ? 'Facture' : 'Ticket CB'}
                {type === 'cb'
                  ? <span style={{ color: 'var(--red)', fontWeight: 400 }}> * (obligatoire)</span>
                  : <span style={{ color: '#888', fontWeight: 400 }}> (optionnel)</span>}
              </label>
              <div
                onClick={() => fFileRef.current?.click()}
                style={{ border: `2px dashed ${fFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', background: fExtracting ? '#FFFBF0' : fFile ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.15s' }}
              >
                {fExtracting ? (
                  <div>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⏳</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>Analyse du document en cours…</div>
                  </div>
                ) : fFile ? (
                  <div>
                    {fFilePreview && <img src={fFilePreview} alt="Aperçu" style={{ maxHeight: 120, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem', objectFit: 'contain' }} />}
                    <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {fFile.name}</div>
                    {fExtracted && <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '0.2rem' }}>Données extraites automatiquement — vérifiez ci-dessous</div>}
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer pour changer</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{type === 'cb' ? '📄' : '🧾'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{type === 'cb' ? 'Cliquer pour ajouter la facture' : 'Cliquer pour ajouter le ticket CB'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem' }}>Image ou PDF — les champs seront remplis automatiquement</div>
                  </div>
                )}
              </div>
              <input ref={fFileRef} type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>

            {/* Champs auto-remplis et modifiables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input className="form-input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Employé *</label>
                <select className="form-input" value={fEmployee} onChange={e => setFEmployee(e.target.value)} required>
                  <option value="">Sélectionner…</option>
                  {employees.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {type === 'cb' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fournisseur</label>
                  <input className="form-input" value={fSupplier} onChange={e => setFSupplier(e.target.value)} placeholder="Nom du fournisseur" />
                </div>
              )}
            </div>

            {/* Montants */}
            {type === 'cb' ? (
              <div style={{ background: '#F8F8F8', border: '1px solid #EEE', borderRadius: '0.5rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#666', marginBottom: '0.1rem' }}>Montants</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>Montant HT</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={fAmountHT} onChange={e => {
                      setFAmountHT(e.target.value)
                      const ht = parseFloat(e.target.value)
                      const tva = parseFloat(fTvaRate)
                      if (!isNaN(ht) && !isNaN(tva)) setFAmount(String((ht * (1 + tva / 100)).toFixed(2)))
                    }} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>TVA %</label>
                    <input className="form-input" type="number" step="0.1" min="0" value={fTvaRate} onChange={e => {
                      setFTvaRate(e.target.value)
                      const ht = parseFloat(fAmountHT)
                      const tva = parseFloat(e.target.value)
                      if (!isNaN(ht) && !isNaN(tva)) setFAmount(String((ht * (1 + tva / 100)).toFixed(2)))
                    }} placeholder="20" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>Montant TTC *</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" required />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
                <input className="form-input" type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" required />
              </div>
            )}

            {/* Devise — MAD par défaut */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Devise</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setFCurrency('MAD')} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fCurrency === 'MAD' ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: fCurrency === 'MAD' ? '#FFF5F0' : 'white', fontWeight: fCurrency === 'MAD' ? 700 : 400, cursor: 'pointer', color: fCurrency === 'MAD' ? 'var(--terracotta)' : 'var(--text)' }}>MAD</button>
                <button type="button" onClick={() => setFCurrency('EUR')} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fCurrency === 'EUR' ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: fCurrency === 'EUR' ? '#FFF5F0' : 'white', fontWeight: fCurrency === 'EUR' ? 700 : 400, cursor: 'pointer', color: fCurrency === 'EUR' ? 'var(--terracotta)' : 'var(--text)' }}>EUR</button>
              </div>
            </div>

            {/* Mode paiement (dépenses) — boutons */}
            {type === 'cb' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Mode de paiement</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {PAYMENT_MODES.map(p => (
                    <button key={p} type="button" onClick={() => setFPayment(p)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${fPayment === p ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: fPayment === p ? '#FFF5F0' : 'white', fontWeight: fPayment === p ? 700 : 400, cursor: 'pointer', color: fPayment === p ? 'var(--terracotta)' : 'var(--text)', fontSize: '0.85rem' }}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Catégorie + Description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
                <select className="form-input" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
                <input className="form-input" value={fDescription} onChange={e => setFDescription(e.target.value)} placeholder="Note optionnelle" />
              </div>
            </div>

            {formError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{formError}</p>}
            <button className="btn-primary" type="submit" disabled={submitting || fUploading || fExtracting}>{fExtracting ? '🤖 Analyse document…' : fUploading ? '⬆️ Upload…' : submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
          </form>
        </div>
      )}

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
        <span style={{ marginLeft: 'auto', fontWeight: 600, color }}>Total : {fmt(total)}</span>
      </div>

      {loading ? <p>Chargement…</p> : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucune entrée pour ce mois</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Employé</th><th>Catégorie</th>
                {type === 'cb' && <><th>Fournisseur</th><th>Paiement</th></>}
                <th>Devise</th><th>Montant</th>
                <th>Justificatif</th>
                <th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td>{e.employee_name}</td>
                  <td>{e.category}</td>
                  {type === 'cb' && <><td>{e.supplier || '—'}</td><td>{e.payment || '—'}</td></>}
                  <td><span style={{ fontWeight: 600, fontSize: '0.8rem', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>{(e.currency as string) || 'MAD'}</span></td>
                  <td style={{ fontWeight: 600, color }}>{fmt(Number(e.amount))}</td>
                  <td>
                    {e.invoice_url
                      ? <a href={e.invoice_url as string} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: '0.8rem' }}>{type === 'cash' ? '🧾 Ticket' : '📄 Facture'}</a>
                      : <button onClick={() => { setPendingUploadEntry(e.id); rowFileRef.current?.click() }} disabled={uploadingEntryId === e.id} style={{ background: 'none', border: '1px dashed #aaa', borderRadius: '0.3rem', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>{uploadingEntryId === e.id ? '⬆️…' : '📎 Ajouter'}</button>
                    }
                  </td>
                  <td><span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => toggleStatus(e)} style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>{e.status === 'pending' ? '✓' : '↩'}</button>
                    <button onClick={() => setDeleteModal(e.id)} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <input ref={rowFileRef} type="file" accept="image/*,application/pdf" onChange={handleRowUpload} style={{ display: 'none' }} />

      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Supprimer cette entrée ?</p>
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

// ─── Fond de caisse Tab ───────────────────────────────────────────────────────

const FONDS_CATEGORIES = ['Courses/Marché','Entretien','Personnel','Transport','Pourboire','Recette cash','Remboursement','Autre']

function FondsTab() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<FondsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Dotation
  const [dotationMAD, setDotationMAD] = useState(2000)
  const [dotationEUR, setDotationEUR] = useState(200)
  const [showDotationEdit, setShowDotationEdit] = useState(false)
  const [editMAD, setEditMAD] = useState('')
  const [editEUR, setEditEUR] = useState('')
  const [savingDotation, setSavingDotation] = useState(false)

  // Form state
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [date, setDate] = useState(now.toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(FONDS_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [employeeName, setEmployeeName] = useState('Administrateur')
  const [fondsEmployees, setFondsEmployees] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/fonds?month=${month}`)
    setEntries(await r.json())
    setLoading(false)
  }, [month])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      setFondsEmployees(emps.filter(e => e.active).map(e => e.name))
    })
    fetch('/api/settings/fond-caisse').then(r => r.json()).then(d => {
      setDotationMAD(d.fond_caisse_mad ?? 2000)
      setDotationEUR(d.fond_caisse_eur ?? 200)
    })
  }, [])

  async function saveDotation() {
    setSavingDotation(true)
    await fetch('/api/settings/fond-caisse', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fond_caisse_mad: parseFloat(editMAD), fond_caisse_eur: parseFloat(editEUR) }),
    })
    setDotationMAD(parseFloat(editMAD))
    setDotationEUR(parseFloat(editEUR))
    setShowDotationEdit(false)
    setSavingDotation(false)
  }

  const totalIn = entries.filter(e => e.direction === 'in').reduce((s, e) => s + Number(e.amount), 0)
  const totalOut = entries.filter(e => e.direction === 'out').reduce((s, e) => s + Number(e.amount), 0)
  const solde = totalIn - totalOut

  async function toggleStatus(entry: FondsEntry) {
    await fetch(`/api/fonds/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: entry.status === 'pending' ? 'validated' : 'pending' }) })
    fetchEntries()
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/fonds/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    const r = await fetch('/api/fonds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, date, amount: parseFloat(amount), currency, category, description, employee_name: employeeName }),
    })
    if (r.ok) {
      setAmount(''); setDescription(''); setShowForm(false)
      fetchEntries()
    } else {
      const d = await r.json()
      setFormError(d.error || 'Erreur')
    }
    setSubmitting(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366F1' }}>💰 Fond de caisse — {formatMonth(month)}</h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === currentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: month === currentMonth ? 'default' : 'pointer', opacity: month === currentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>

      {/* Dotation initiale */}
      <div className="card" style={{ marginBottom: '1rem', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Dotation fond de caisse</div>
            {showDotationEdit ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="number" min="0" step="0.01" value={editMAD} onChange={e => setEditMAD(e.target.value)} placeholder="MAD" style={{ width: '100px', padding: '0.3rem 0.5rem', border: '1px solid #C7D2FE', borderRadius: '0.4rem', fontSize: '0.9rem' }} />
                <span style={{ fontWeight: 600, color: '#6366F1' }}>MAD</span>
                <span style={{ color: '#aaa' }}>+</span>
                <input type="number" min="0" step="0.01" value={editEUR} onChange={e => setEditEUR(e.target.value)} placeholder="EUR" style={{ width: '100px', padding: '0.3rem 0.5rem', border: '1px solid #C7D2FE', borderRadius: '0.4rem', fontSize: '0.9rem' }} />
                <span style={{ fontWeight: 600, color: '#6366F1' }}>EUR</span>
                <button onClick={saveDotation} disabled={savingDotation} style={{ background: '#6366F1', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>{savingDotation ? '…' : 'Enregistrer'}</button>
                <button onClick={() => setShowDotationEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.85rem' }}>Annuler</button>
              </div>
            ) : (
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4338CA' }}>
                {dotationMAD.toLocaleString('fr-FR')} MAD &nbsp;+&nbsp; {dotationEUR.toLocaleString('fr-FR')} EUR
              </div>
            )}
          </div>
          {!showDotationEdit && (
            <button onClick={() => { setEditMAD(String(dotationMAD)); setEditEUR(String(dotationEUR)); setShowDotationEdit(true) }} style={{ background: 'white', border: '1px solid #C7D2FE', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#6366F1', fontWeight: 600 }}>✏️ Modifier</button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Entrées</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--green)' }}>+{fmt(totalIn)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Sorties</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--red)' }}>-{fmt(totalOut)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: solde >= 0 ? '#6366F1' : 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Solde</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: solde >= 0 ? '#6366F1' : 'var(--red)' }}>{solde >= 0 ? '+' : ''}{fmt(solde)}</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sens *</label>
                <select className="form-input" value={direction} onChange={e => setDirection(e.target.value as 'in' | 'out')}>
                  <option value="out">💸 Sortie (dépense)</option>
                  <option value="in">💰 Entrée (recette)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
                <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
                <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                  {FONDS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Employé *</label>
                <select className="form-input" value={employeeName} onChange={e => setEmployeeName(e.target.value)}>
                  <option value="Administrateur">Administrateur</option>
                  {fondsEmployees.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
                <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Note optionnelle" />
              </div>
            </div>
            {formError && <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{formError}</p>}
            <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
          </form>
        </div>
      )}

      {loading ? <p>Chargement…</p> : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun mouvement pour ce mois</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Sens</th><th>Catégorie</th><th>Employé</th><th>Devise</th><th>Montant</th><th>Description</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)', fontSize: '0.85rem' }}>
                      {e.direction === 'in' ? '↑ Entrée' : '↓ Sortie'}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td>{e.employee_name}</td>
                  <td><span style={{ fontWeight: 600, fontSize: '0.8rem', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>{(e.currency as string) || 'MAD'}</span></td>
                  <td style={{ fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)' }}>{e.direction === 'in' ? '+' : '-'}{fmt(Number(e.amount))}</td>
                  <td style={{ fontSize: '0.85rem', color: '#666' }}>{e.description || '—'}</td>
                  <td><span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => toggleStatus(e)} style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>{e.status === 'pending' ? '✓' : '↩'}</button>
                    <button onClick={() => setDeleteModal(e.id)} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Supprimer ce mouvement ?</p>
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

// ─── Coffre Fort Tab ──────────────────────────────────────────────────────────

const COFFRE_CATEGORIES = ['Dépôt espèces', 'Retrait espèces', 'Chèque', 'Document', 'Bijou / objet de valeur', 'Autre']

interface CoffreEntry {
  id: number
  employee_name: string
  direction: 'in' | 'out'
  date: string
  amount: number
  currency: string
  category: string
  description: string | null
  status: string
  created_at: string
}

function CoffreTab() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<CoffreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [coffreEmployees, setCoffreEmployees] = useState<string[]>([])

  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [date, setDate] = useState(now.toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(COFFRE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [employeeName, setEmployeeName] = useState('Administrateur')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/coffre?month=${month}`)
    setEntries(await r.json())
    setLoading(false)
  }, [month])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((emps: Employee[]) => {
      setCoffreEmployees(emps.filter(e => e.active).map(e => e.name))
    })
  }, [])

  const totalIn  = entries.filter(e => e.direction === 'in').reduce((s, e) => s + Number(e.amount), 0)
  const totalOut = entries.filter(e => e.direction === 'out').reduce((s, e) => s + Number(e.amount), 0)
  const solde    = totalIn - totalOut

  async function toggleStatus(entry: CoffreEntry) {
    await fetch(`/api/coffre/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: entry.status === 'pending' ? 'validated' : 'pending' }) })
    fetchEntries()
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/coffre/${id}`, { method: 'DELETE' })
    setDeleteModal(null)
    fetchEntries()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setFormError('')
    const r = await fetch('/api/coffre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, date, amount: parseFloat(amount), currency, category, description, employee_name: employeeName }),
    })
    if (r.ok) {
      setAmount(''); setDescription(''); setShowForm(false)
      fetchEntries()
    } else {
      const d = await r.json()
      setFormError(d.error || 'Erreur')
    }
    setSubmitting(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151' }}>🔐 Coffre fort — {formatMonth(month)}</h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === currentMonth} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: month === currentMonth ? 'default' : 'pointer', opacity: month === currentMonth ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ background: '#374151' }}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>

      {/* Solde */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="stat-card" style={{ borderLeftColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Dépôts</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--green)' }}>+{totalIn.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Retraits</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--red)' }}>-{totalOut.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: solde >= 0 ? '#374151' : 'var(--red)' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Solde estimé</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: solde >= 0 ? '#374151' : 'var(--red)' }}>{solde >= 0 ? '+' : ''}{solde.toFixed(2)}</div>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sens *</label>
                <select className="form-input" value={direction} onChange={e => setDirection(e.target.value as 'in' | 'out')}>
                  <option value="in">🔒 Dépôt (entrée)</option>
                  <option value="out">🔓 Retrait (sortie)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
                <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
                <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                  {COFFRE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Par</label>
                <select className="form-input" value={employeeName} onChange={e => setEmployeeName(e.target.value)}>
                  <option value="Administrateur">Administrateur</option>
                  {coffreEmployees.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
                <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Note optionnelle" />
              </div>
            </div>
            {formError && <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{formError}</p>}
            <button className="btn-primary" type="submit" disabled={submitting} style={{ background: '#374151' }}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
          </form>
        </div>
      )}

      {loading ? <p>Chargement…</p> : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun mouvement pour ce mois</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Sens</th><th>Catégorie</th><th>Par</th><th>Devise</th><th>Montant</th><th>Description</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td><span style={{ fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)', fontSize: '0.85rem' }}>{e.direction === 'in' ? '🔒 Dépôt' : '🔓 Retrait'}</span></td>
                  <td>{e.category}</td>
                  <td>{e.employee_name}</td>
                  <td><span style={{ fontWeight: 600, fontSize: '0.8rem', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>{e.currency}</span></td>
                  <td style={{ fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)' }}>{e.direction === 'in' ? '+' : '-'}{Number(e.amount).toFixed(2)}</td>
                  <td style={{ fontSize: '0.85rem', color: '#666' }}>{e.description || '—'}</td>
                  <td><span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => toggleStatus(e)} style={{ background: e.status === 'pending' ? 'var(--green)' : '#888', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>{e.status === 'pending' ? '✓' : '↩'}</button>
                    <button onClick={() => setDeleteModal(e.id)} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Supprimer ce mouvement ?</p>
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
    setEmployees(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), poste: poste.trim() || 'Employé' }) })
    setName(''); setPoste(''); setShowForm(false); setAdding(false)
    fetchEmployees()
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !emp.active }) })
    fetchEmployees()
  }

  function copyLink(emp: Employee) {
    navigator.clipboard.writeText(`${window.location.origin}/employee?emp=${emp.token}`)
    setCopiedId(emp.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--terracotta)' }}>👥 Employés</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
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
            <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Ajout…' : 'Ajouter'}</button>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emp.active && <button onClick={() => copyLink(emp)} style={{ background: '#EEF2FF', color: 'var(--blue)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{copiedId === emp.id ? '✓ Copié' : '🔗 Copier lien'}</button>}
                <button onClick={() => toggleActive(emp)} style={{ background: emp.active ? '#FEE2E2' : '#D1FAE5', color: emp.active ? 'var(--red)' : 'var(--green)', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{emp.active ? 'Désactiver' : 'Réactiver'}</button>
              </div>
            </div>
          ))}
          {employees.length === 0 && <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun employé</div>}
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
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelUploading, setExcelUploading] = useState(false)
  const [excelMsg, setExcelMsg] = useState('')
  const [excelError, setExcelError] = useState('')
  const [hasBaseFile, setHasBaseFile] = useState<boolean | null>(null)
  const [dbUpdating, setDbUpdating] = useState(false)
  const [dbMsg, setDbMsg] = useState('')

  useEffect(() => {
    fetch('/api/excel/status').then(r => r.ok ? r.json() : null).then(d => { if (d) setHasBaseFile(d.hasFile) })
  }, [])

  async function uploadExcel(e: React.FormEvent) {
    e.preventDefault()
    if (!excelFile) return
    setExcelUploading(true); setExcelMsg(''); setExcelError('')
    const form = new FormData()
    form.append('file', excelFile)
    const r = await fetch('/api/excel/upload', { method: 'POST', body: form })
    if (r.ok) { setExcelMsg('Fichier Excel enregistré ! L\'export Excel intégrera maintenant vos onglets existants.'); setHasBaseFile(true); setExcelFile(null) }
    else { const d = await r.json(); setExcelError(d.error || 'Erreur upload.') }
    setExcelUploading(false)
  }

  async function removeExcel() {
    await fetch('/api/excel/upload', { method: 'DELETE' })
    setHasBaseFile(false); setExcelMsg('Fichier supprimé.')
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinMsg(''); setPinError('')
    if (newPin !== confirmPin) { setPinError('Les PINs ne correspondent pas.'); return }
    if (newPin.length < 4) { setPinError('Le PIN doit faire au moins 4 caractères.'); return }
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPin, newPin }) })
    if (r.ok) { setPinMsg('PIN modifié.'); setCurrentPin(''); setNewPin(''); setConfirmPin('') }
    else { const d = await r.json(); setPinError(d.error || 'Erreur.') }
  }

  async function resetAll() {
    await fetch('/api/settings/reset', { method: 'DELETE' })
    setResetModal(false)
    onLogout()
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--terracotta)' }}>⚙️ Paramètres</h2>

      {/* DB migration */}
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem', borderLeft: '4px solid var(--terracotta)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🗄️ Mise à jour base de données</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          À effectuer une fois après une mise à jour de l&apos;application pour ajouter les nouvelles colonnes.
        </p>
        <button className="btn-primary" disabled={dbUpdating} onClick={async () => {
          setDbUpdating(true); setDbMsg('')
          const r = await fetch('/api/init', { method: 'POST' })
          setDbMsg(r.ok ? '✓ Base de données à jour !' : '✗ Erreur, réessayez.')
          setDbUpdating(false)
        }}>
          {dbUpdating ? 'Mise à jour…' : '🔄 Mettre à jour'}
        </button>
        {dbMsg && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: dbMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{dbMsg}</p>}
      </div>

      {/* Excel base file */}
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem', borderLeft: '4px solid #2D6A4F' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📎 Fichier Excel de référence</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Uploadez votre <strong>COMPTES RIAD 2026.xlsx</strong> ici. Lors du téléchargement Excel (bouton 📊 en haut), vos onglets existants seront préservés et les 3 nouveaux onglets (Encaissements, Dépenses, Fond de caisse) seront automatiquement mis à jour avec les données actuelles.
        </p>
        {hasBaseFile && (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#2D6A4F', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✓ Fichier Excel enregistré</span>
            <button onClick={removeExcel} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Supprimer</button>
          </div>
        )}
        <form onSubmit={uploadExcel} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx" onChange={e => setExcelFile(e.target.files?.[0] || null)} style={{ fontSize: '0.85rem', flex: 1, minWidth: 200 }} />
          <button className="btn-primary" type="submit" disabled={!excelFile || excelUploading} style={{ background: '#2D6A4F', whiteSpace: 'nowrap' }}>
            {excelUploading ? 'Upload…' : hasBaseFile ? '🔄 Remplacer' : '⬆️ Uploader'}
          </button>
        </form>
        {excelMsg && <p style={{ color: 'var(--green)', fontSize: '0.825rem', marginTop: '0.5rem' }}>{excelMsg}</p>}
        {excelError && <p style={{ color: 'var(--red)', fontSize: '0.825rem', marginTop: '0.5rem' }}>{excelError}</p>}
      </div>

      <div className="card" style={{ maxWidth: 420, marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Changer le PIN</h3>
        <form onSubmit={changePin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>PIN actuel</label><input className="form-input" type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} required /></div>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nouveau PIN</label><input className="form-input" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} required /></div>
          <div><label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Confirmer</label><input className="form-input" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} required /></div>
          {pinError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{pinError}</p>}
          {pinMsg && <p style={{ color: 'var(--green)', fontSize: '0.875rem' }}>{pinMsg}</p>}
          <button className="btn-primary" type="submit">Enregistrer</button>
        </form>
      </div>
      <div className="card" style={{ maxWidth: 420, borderLeft: '4px solid var(--red)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red)' }}>Zone dangereuse</h3>
        <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>Réinitialiser supprime toutes les données et remet le PIN par défaut.</p>
        <button style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setResetModal(true)}>Réinitialiser toutes les données</button>
      </div>
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>⚠️ Réinitialisation</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>Toutes les données seront supprimées.</p>
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
