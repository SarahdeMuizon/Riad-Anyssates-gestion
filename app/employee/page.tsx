'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Entry, FondsEntry } from '@/types'
import { Suspense } from 'react'

const DEPENSES_CATEGORIES = ['Alimentation/Courses','Fournitures & bureautique','Entretien & maintenance','Transport','Restauration','Pharmacie/Hygiène','Décoration & fleurs','Autre']
const ENCAISSEMENTS_CATEGORIES = ['Boissons bar','Repas/Restauration','Activité/Excursion','Service spa/Hammam','Transfert/Transport','Pourboire collectif','Autre encaissement']
const FONDS_CATEGORIES = ['Courses/Marché','Entretien','Personnel','Transport','Pourboire','Recette cash','Remboursement','Autre']
const PAYMENT_MODES = ['CB', 'Virement', 'Chèque']
const CURRENCIES = ['EUR', 'MAD']

type Tab = 'cb' | 'cash' | 'fonds' | 'history'

interface EmployeeInfo { id: number; name: string; poste: string }

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
      .then(data => { if (data.error) setAuthError(data.error); else setEmployee(data) })
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'cb', label: '💳 Dépense' },
    { id: 'cash', label: '💵 Encaissement' },
    { id: 'fonds', label: '💰 Fond de caisse' },
    { id: 'history', label: '📋 Mon historique' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--terracotta)', color: 'white', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ fontWeight: 700 }}>🏨 Riad Anyssates</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{employee.name}</div>
      </header>
      <div style={{ background: 'white', borderBottom: '1px solid #EDE0D6', padding: '0 1rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.75rem 0.875rem', border: 'none', borderBottom: tab === t.id ? '2px solid var(--terracotta)' : '2px solid transparent', background: 'transparent', color: tab === t.id ? 'var(--terracotta)' : 'var(--text)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <main style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
        {tab === 'cb' && <DepenseForm token={token!} />}
        {tab === 'cash' && <EncaissementForm token={token!} />}
        {tab === 'fonds' && <FondsForm token={token!} />}
        {tab === 'history' && <EmployeeHistory token={token!} />}
      </main>
    </div>
  )
}

// ─── Dépense Form (with mandatory invoice upload + split) ─────────────────────

interface SplitLine { id: number; category: string; amount: string }

function DepenseForm({ token }: { token: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [category, setCategory] = useState(DEPENSES_CATEGORIES[0])
  const [supplier, setSupplier] = useState('')
  const [payment, setPayment] = useState(PAYMENT_MODES[0])
  const [description, setDescription] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Split feature
  const [splitMode, setSplitMode] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: 1, category: DEPENSES_CATEGORIES[0], amount: '' },
    { id: 2, category: DEPENSES_CATEGORIES[1], amount: '' },
  ])
  const splitTotal = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const ticketTotal = parseFloat(amount) || 0
  const splitDiff = Math.abs(ticketTotal - splitTotal)
  const splitValid = ticketTotal > 0 && splitDiff < 0.01 && splitLines.every(l => parseFloat(l.amount) > 0)

  function addSplitLine() {
    setSplitLines(prev => [...prev, { id: Date.now(), category: DEPENSES_CATEGORIES[0], amount: '' }])
  }
  function removeSplitLine(id: number) {
    setSplitLines(prev => prev.filter(l => l.id !== id))
  }
  function updateSplitLine(id: number, field: 'category' | 'amount', value: string) {
    setSplitLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setInvoiceFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setInvoicePreview(url)
    } else {
      setInvoicePreview(null)
    }
  }

  async function uploadToCloudinary(file: File): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !preset) throw new Error('Cloudinary non configuré')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', preset)
    formData.append('folder', 'riad-factures')

    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData })
    if (!r.ok) throw new Error('Erreur upload Cloudinary')
    const data = await r.json()
    return data.secure_url as string
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')

    if (!invoiceFile) { setError('La facture est obligatoire.'); return }
    if (splitMode && !splitValid) { setError(`La somme des lignes (${splitTotal.toFixed(2)}) doit égaler le total du ticket (${amount}).`); return }

    setUploading(true)
    let invoice_url: string
    try {
      invoice_url = await uploadToCloudinary(invoiceFile)
    } catch (err) {
      setError((err as Error).message || 'Erreur upload facture.')
      setUploading(false); return
    }
    setUploading(false)
    setSubmitting(true)

    try {
      if (splitMode) {
        // Create one entry per split line
        const results = await Promise.all(splitLines.map(line =>
          fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'cb', date, amount: parseFloat(line.amount), currency, category: line.category, supplier, payment, description: `${description ? description + ' — ' : ''}Ticket ventilé`, invoice_url, token }),
          })
        ))
        if (results.every(r => r.ok)) {
          setSuccess(`Ticket ventilé en ${splitLines.length} postes ✓`)
          setAmount(''); setSupplier(''); setDescription(''); setInvoiceFile(null); setInvoicePreview(null)
          setCategory(DEPENSES_CATEGORIES[0]); setPayment(PAYMENT_MODES[0]); setCurrency('EUR')
          setDate(new Date().toISOString().split('T')[0]); setSplitMode(false)
          setSplitLines([{ id: 1, category: DEPENSES_CATEGORIES[0], amount: '' }, { id: 2, category: DEPENSES_CATEGORIES[1], amount: '' }])
          if (fileRef.current) fileRef.current.value = ''
        } else { setError('Erreur lors de la création des lignes.') }
      } else {
        const r = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cb', date, amount: parseFloat(amount), currency, category, supplier, payment, description, invoice_url, token }),
        })
        if (r.ok) {
          setSuccess('Dépense enregistrée avec succès !')
          setAmount(''); setSupplier(''); setDescription(''); setInvoiceFile(null); setInvoicePreview(null)
          setCategory(DEPENSES_CATEGORIES[0]); setPayment(PAYMENT_MODES[0]); setCurrency('EUR')
          setDate(new Date().toISOString().split('T')[0])
          if (fileRef.current) fileRef.current.value = ''
        } else { const d = await r.json(); setError(d.error || 'Erreur.') }
      }
    } catch { setError('Erreur de connexion.') }
    setSubmitting(false)
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--terracotta)' }}>💳 Nouvelle dépense</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {CURRENCIES.map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${currency === c ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: currency === c ? '#FFF5F0' : 'white', fontWeight: currency === c ? 700 : 400, cursor: 'pointer', color: currency === c ? 'var(--terracotta)' : 'var(--text)' }}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fournisseur / Lieu</label>
          <input className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nom du fournisseur" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de paiement</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {PAYMENT_MODES.map(p => (
              <button key={p} type="button" onClick={() => setPayment(p)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${payment === p ? 'var(--terracotta)' : '#ddd'}`, borderRadius: '0.5rem', background: payment === p ? '#FFF5F0' : 'white', fontWeight: payment === p ? 700 : 400, cursor: 'pointer', color: payment === p ? 'var(--terracotta)' : 'var(--text)', fontSize: '0.85rem' }}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>

        {/* Split ticket toggle */}
        <div style={{ background: '#FFF5F0', border: '1px solid #FDDCCA', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={splitMode} onChange={e => setSplitMode(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--terracotta)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--terracotta)' }}>✂️ Ventiler ce ticket en plusieurs catégories</span>
          </label>
          {splitMode && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.5rem' }}>Total ticket : <strong>{ticketTotal.toFixed(2)} {currency}</strong> — Répartissez le montant ci-dessous :</p>
              {splitLines.map((line, idx) => (
                <div key={line.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <select className="form-input" value={line.category} onChange={e => updateSplitLine(line.id, 'category', e.target.value)} style={{ flex: 2 }}>
                    {DEPENSES_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="form-input" type="number" step="0.01" min="0" value={line.amount} onChange={e => updateSplitLine(line.id, 'amount', e.target.value)} placeholder="0.00" style={{ flex: 1, minWidth: 80 }} />
                  {splitLines.length > 2 && (
                    <button type="button" onClick={() => removeSplitLine(line.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addSplitLine} style={{ fontSize: '0.8rem', color: 'var(--terracotta)', background: 'none', border: '1px dashed var(--terracotta)', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>+ Ajouter une ligne</button>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: splitValid ? 'var(--green)' : (splitTotal > 0 ? 'var(--red)' : '#888') }}>
                Réparti : {splitTotal.toFixed(2)} / {ticketTotal.toFixed(2)} {currency}
                {splitValid && ' ✓'}
                {!splitValid && splitTotal > 0 && ` (différence : ${splitDiff.toFixed(2)})`}
              </div>
            </div>
          )}
        </div>

        {!splitMode && (
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
              {DEPENSES_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Mandatory invoice upload */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Facture * <span style={{ color: 'var(--red)' }}>(obligatoire)</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${invoiceFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: invoiceFile ? '#F0FDF4' : '#FAFAFA' }}
          >
            {invoiceFile ? (
              <div>
                {invoicePreview && <img src={invoicePreview} alt="Aperçu" style={{ maxHeight: 120, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem' }} />}
                <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {invoiceFile.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer pour changer</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📄</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Cliquer pour ajouter une photo ou PDF de la facture</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600 }}>{success}</p>}

        <button className="btn-primary" type="submit" disabled={uploading || submitting}>
          {uploading ? '⬆️ Upload facture…' : submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}

// ─── Encaissement Form ─────────────────────────────────────────────────────────

function EncaissementForm({ token }: { token: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [category, setCategory] = useState(ENCAISSEMENTS_CATEGORIES[0])
  const [payment, setPayment] = useState(PAYMENT_MODES[0])
  const [description, setDescription] = useState('')
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [ticketPreview, setTicketPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const ticketRef = useRef<HTMLInputElement>(null)

  function handleTicket(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setTicketFile(f)
    if (f.type.startsWith('image/')) setTicketPreview(URL.createObjectURL(f))
    else setTicketPreview(null)
  }

  async function uploadToCloudinary(file: File): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !preset) throw new Error('Cloudinary non configuré')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', preset)
    formData.append('folder', 'riad-tickets')
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData })
    if (!r.ok) throw new Error('Erreur upload ticket')
    const data = await r.json()
    return data.secure_url as string
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')

    let invoice_url: string | undefined
    if (ticketFile) {
      setUploading(true)
      try { invoice_url = await uploadToCloudinary(ticketFile) }
      catch (err) { setError((err as Error).message || 'Erreur upload ticket.'); setUploading(false); return }
      setUploading(false)
    }

    setSubmitting(true)
    try {
      const r = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cash', date, amount: parseFloat(amount), currency, category, payment, description, invoice_url, token }),
      })
      if (r.ok) {
        setSuccess('Encaissement enregistré !')
        setAmount(''); setDescription(''); setCategory(ENCAISSEMENTS_CATEGORIES[0]); setPayment(PAYMENT_MODES[0]); setCurrency('EUR')
        setDate(new Date().toISOString().split('T')[0]); setTicketFile(null); setTicketPreview(null)
        if (ticketRef.current) ticketRef.current.value = ''
      } else { const d = await r.json(); setError(d.error || 'Erreur.') }
    } catch { setError('Erreur de connexion.') }
    setSubmitting(false)
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--green)' }}>💵 Nouvel encaissement</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {CURRENCIES.map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${currency === c ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', background: currency === c ? '#F0FDF4' : 'white', fontWeight: currency === c ? 700 : 400, cursor: 'pointer', color: currency === c ? 'var(--green)' : 'var(--text)' }}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {ENCAISSEMENTS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de paiement</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {PAYMENT_MODES.map(p => (
              <button key={p} type="button" onClick={() => setPayment(p)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${payment === p ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', background: payment === p ? '#F0FDF4' : 'white', fontWeight: payment === p ? 700 : 400, cursor: 'pointer', color: payment === p ? 'var(--green)' : 'var(--text)', fontSize: '0.85rem' }}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>

        {/* Optional ticket CB upload */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Ticket CB <span style={{ color: '#888', fontWeight: 400 }}>(optionnel)</span>
          </label>
          <div
            onClick={() => ticketRef.current?.click()}
            style={{ border: `2px dashed ${ticketFile ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: ticketFile ? '#F0FDF4' : '#FAFAFA' }}
          >
            {ticketFile ? (
              <div>
                {ticketPreview && <img src={ticketPreview} alt="Aperçu" style={{ maxHeight: 100, maxWidth: '100%', marginBottom: '0.5rem', borderRadius: '0.3rem' }} />}
                <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600 }}>✓ {ticketFile.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>Cliquer pour changer</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🧾</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Photo du ticket CB (optionnel)</div>
              </div>
            )}
          </div>
          <input ref={ticketRef} type="file" accept="image/*,application/pdf" onChange={handleTicket} style={{ display: 'none' }} />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600 }}>{success}</p>}

        <button className="btn-primary" type="submit" disabled={uploading || submitting} style={{ background: 'var(--green)' }}>
          {uploading ? '⬆️ Upload ticket…' : submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}

// ─── Fond de caisse Form ──────────────────────────────────────────────────────

function FondsForm({ token }: { token: string }) {
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [category, setCategory] = useState(FONDS_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const r = await fetch('/api/fonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, date, amount: parseFloat(amount), currency, category, description, token }),
      })
      if (r.ok) {
        setSuccess('Mouvement enregistré !')
        setAmount(''); setDescription(''); setCategory(FONDS_CATEGORIES[0])
        setDate(new Date().toISOString().split('T')[0])
      } else { const d = await r.json(); setError(d.error || 'Erreur.') }
    } catch { setError('Erreur de connexion.') }
    setSubmitting(false)
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem', color: '#6366F1' }}>💰 Fond de caisse</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sens du mouvement *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setDirection('out')} style={{ flex: 1, padding: '0.6rem', border: `2px solid ${direction === 'out' ? 'var(--red)' : '#ddd'}`, borderRadius: '0.5rem', background: direction === 'out' ? '#FEF2F2' : 'white', fontWeight: direction === 'out' ? 700 : 400, cursor: 'pointer', color: direction === 'out' ? 'var(--red)' : 'var(--text)' }}>💸 Sortie (dépense)</button>
            <button type="button" onClick={() => setDirection('in')} style={{ flex: 1, padding: '0.6rem', border: `2px solid ${direction === 'in' ? 'var(--green)' : '#ddd'}`, borderRadius: '0.5rem', background: direction === 'in' ? '#F0FDF4' : 'white', fontWeight: direction === 'in' ? 700 : 400, cursor: 'pointer', color: direction === 'in' ? 'var(--green)' : 'var(--text)' }}>💰 Entrée (recette)</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Montant *</label>
            <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Devise</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {CURRENCIES.map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)} style={{ flex: 1, padding: '0.5rem', border: `2px solid ${currency === c ? '#6366F1' : '#ddd'}`, borderRadius: '0.5rem', background: currency === c ? '#EEF2FF' : 'white', fontWeight: currency === c ? 700 : 400, cursor: 'pointer', color: currency === c ? '#6366F1' : 'var(--text)' }}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Catégorie *</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {FONDS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
          <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes optionnelles…" />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 600 }}>{success}</p>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ background: '#6366F1' }}>
          {submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  )
}

// ─── History ───────────────────────────────────────────────────────────────────

function EmployeeHistory({ token }: { token: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [fondsEntries, setFondsEntries] = useState<FondsEntry[]>([])
  const [activeSection, setActiveSection] = useState<'entries' | 'fonds'>('entries')
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    const [entriesR, fondsR] = await Promise.all([
      fetch(`/api/entries?token=${token}`),
      fetch(`/api/fonds?token=${token}`),
    ])
    setEntries(await entriesR.json())
    setFondsEntries(await fondsR.json())
    setLoading(false)
  }, [token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (loading) return <p>Chargement…</p>

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--terracotta)' }}>📋 Mon historique</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={() => setActiveSection('entries')} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '0.5rem', background: activeSection === 'entries' ? 'var(--terracotta)' : '#EDE0D6', color: activeSection === 'entries' ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Dépenses & Encaissements</button>
        <button onClick={() => setActiveSection('fonds')} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '0.5rem', background: activeSection === 'fonds' ? '#6366F1' : '#EEF2FF', color: activeSection === 'fonds' ? 'white' : '#6366F1', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Fond de caisse</button>
      </div>

      {activeSection === 'entries' && (
        entries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucune entrée pour le moment.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {entries.map(e => (
              <div key={e.id} className="card" style={{ borderLeft: `4px solid ${e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)', textTransform: 'uppercase' }}>{e.type === 'cb' ? 'Dépense' : 'Encaissement'}</span>
                    <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{e.category}</div>
                    {e.supplier && <div style={{ fontSize: '0.8rem', color: '#888' }}>{e.supplier}</div>}
                    {e.payment && <div style={{ fontSize: '0.8rem', color: '#888' }}>{e.payment}</div>}
                    {e.description && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>{e.description}</div>}
                    {e.invoice_url && <a href={e.invoice_url as string} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--blue)', display: 'inline-block', marginTop: '0.2rem' }}>📄 Voir facture</a>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: e.type === 'cb' ? 'var(--terracotta)' : 'var(--green)' }}>{Number(e.amount).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>{(e.currency as string) || 'EUR'}</span></div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                    <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'} style={{ display: 'inline-block', marginTop: '0.25rem' }}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeSection === 'fonds' && (
        fondsEntries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Aucun mouvement de fonds.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {fondsEntries.map(e => (
              <div key={e.id} className="card" style={{ borderLeft: `4px solid ${e.direction === 'in' ? 'var(--green)' : 'var(--red)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.direction === 'in' ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{e.direction === 'in' ? '↑ Entrée' : '↓ Sortie'}</span>
                    <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{e.category}</div>
                    {e.description && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>{e.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: e.direction === 'in' ? 'var(--green)' : 'var(--red)' }}>{e.direction === 'in' ? '+' : '-'}{Number(e.amount).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>{(e.currency as string) || 'MAD'}</span></div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                    <span className={e.status === 'validated' ? 'badge-validated' : 'badge-pending'} style={{ display: 'inline-block', marginTop: '0.25rem' }}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
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
