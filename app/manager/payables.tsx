'use client'
// Onglet « À payer » : factures des fournisseurs (NDT, Renaisens, Berghout, Elite Food, artisans…)
// en attente de règlement. Le règlement crée la dépense correspondante.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openAttachment, fileToDataUrl } from '@/lib/attachments'
import { PAYABLE_SUPPLIERS, PAYABLE_OTHER_CATEGORY, payableCategory, type Payable } from '@/lib/payables'
import { DateRangeFilter, EMPTY_RANGE, inRange, rangeActive, type DateRange } from './date-range'

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')
const today = () => new Date().toISOString().slice(0, 10)
const CATEGORIES = ['Prestataire', 'Nourriture', 'Spa', 'Travaux', 'Aménagement/Déco', 'Entretien', 'Livraison/Carrossa', 'Administratif', 'Divers']
const PAYMENTS = ['Virement', 'Chèque', 'Espèces', 'CB', 'Prélèvement']
const OTHER = '__autre__'
const MAX_BYTES = 3_000_000

interface Draft {
  id?: number
  pick: string        // fournisseur habituel ou OTHER
  other: string       // nom libre (artisan…)
  category: string
  date: string
  due_date: string
  reference: string
  description: string
  amount: string
  currency: string
  file: File | null
}

const emptyDraft = (): Draft => ({
  pick: PAYABLE_SUPPLIERS[0].name, other: '', category: PAYABLE_SUPPLIERS[0].category,
  date: today(), due_date: '', reference: '', description: '', amount: '', currency: 'MAD', file: null,
})

const supplierOf = (d: Draft) => (d.pick === OTHER ? d.other.trim() : d.pick)
const isKnown = (s: string) => PAYABLE_SUPPLIERS.some(p => p.name === s)

export default function PayablesTab() {
  const [rows, setRows] = useState<Payable[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [payFor, setPayFor] = useState<Payable | null>(null)
  const [payDate, setPayDate] = useState(today())
  const [payMode, setPayMode] = useState('Virement')
  const [payLoc, setPayLoc] = useState<'coffre' | 'fonds'>('coffre')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todo' | 'paid' | ''>('todo')
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/payables').then(r => r.json()).catch(() => [])
    setRows(Array.isArray(r) ? r : [])
    setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])

  // Fournisseurs libres déjà utilisés (artisans…), proposés à la saisie
  const otherNames = useMemo(() => Array.from(new Set(rows.map(r => r.supplier).filter(s => !isKnown(s)))).sort(), [rows])
  const todayIso = today()
  const overdue = (p: Payable) => p.status === 'todo' && !!p.due_date && p.due_date < todayIso

  // Reste à payer par fournisseur (les artisans sont regroupés)
  const summary = useMemo(() => {
    const groups = [...PAYABLE_SUPPLIERS.map(s => s.name), 'Artisans / autres']
    return groups.map(g => {
      const items = rows.filter(r => r.status === 'todo' && (g === 'Artisans / autres' ? !isKnown(r.supplier) : r.supplier === g))
      return { name: g, count: items.length, total: items.reduce((s, r) => s + (r.currency === 'MAD' ? Number(r.amount) : 0), 0), late: items.some(overdue) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])
  const totalTodo = summary.reduce((s, g) => s + g.total, 0)

  const shown = rows.filter(r =>
    (!filterStatus || r.status === filterStatus) &&
    (!filterSupplier || (filterSupplier === OTHER ? !isKnown(r.supplier) : r.supplier === filterSupplier)) &&
    (!rangeActive(range) || inRange(r.date, range)))
  const shownTotal = shown.reduce((s, r) => s + (r.currency === 'MAD' ? Number(r.amount) : 0), 0)

  function edit(p: Payable) {
    setDraft({
      id: p.id, pick: isKnown(p.supplier) ? p.supplier : OTHER, other: isKnown(p.supplier) ? '' : p.supplier,
      category: p.category || payableCategory(p.supplier), date: p.date, due_date: p.due_date || '',
      reference: p.reference || '', description: p.description || '', amount: String(p.amount), currency: p.currency || 'MAD', file: null,
    })
    setMsg('')
  }

  async function save() {
    if (!draft) return
    const supplier = supplierOf(draft)
    if (!supplier) { setMsg('Indiquez le nom du fournisseur'); return }
    if (!(parseFloat(draft.amount) > 0)) { setMsg('Indiquez le montant'); return }
    if (draft.file && draft.file.size > MAX_BYTES && !draft.file.type.startsWith('image/')) { setMsg('Fichier trop lourd (3 Mo maximum)'); return }
    setSaving(true); setMsg('')
    try {
      const file = draft.file ? await fileToDataUrl(draft.file) : undefined
      const body = {
        supplier, category: draft.category, date: draft.date, due_date: draft.due_date || null,
        reference: draft.reference || null, description: draft.description || null,
        amount: parseFloat(draft.amount), currency: draft.currency, file, filename: draft.file?.name,
      }
      const r = await fetch(draft.id ? `/api/payables/${draft.id}` : '/api/payables', {
        method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur')
      setDraft(null)
      await reload()
    } catch (e) { setMsg((e as Error).message) }
    setSaving(false)
  }

  async function pay() {
    if (!payFor) return
    setSaving(true)
    const r = await fetch(`/api/payables/${payFor.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay: { date: payDate, payment: payMode, cash_location: payLoc } }),
    }).catch(() => null)
    setSaving(false)
    if (!r?.ok) { setMsg('Le règlement n\'a pas pu être enregistré'); return }
    setMsg(`✓ ${payFor.supplier} réglé : la dépense a été ajoutée${payMode === 'Espèces' ? (payLoc === 'coffre' ? ' (coffre fort)' : ' (fond de caisse)') : ''}`)
    setPayFor(null)
    reload()
  }

  async function unpay(p: Payable) {
    if (!confirm(`Annuler le règlement de ${p.supplier} ? La dépense correspondante sera supprimée.`)) return
    await fetch(`/api/payables/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unpay: true }) })
    reload()
  }

  async function remove(p: Payable) {
    if (!confirm(`Supprimer la facture ${p.supplier}${p.reference ? ` n° ${p.reference}` : ''} ?`)) return
    const r = await fetch(`/api/payables/${p.id}`, { method: 'DELETE' })
    if (!r.ok) setMsg((await r.json().catch(() => ({}))).error || 'Erreur')
    reload()
  }

  async function view(p: Payable) {
    const r = await fetch(`/api/payables/${p.id}`).then(r => r.json()).catch(() => null)
    if (r?.file) openAttachment(r.file)
  }

  const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
    border: `1px solid ${active ? 'var(--terracotta)' : '#ddd'}`, background: active ? 'var(--terracotta)' : 'white', color: active ? 'white' : 'var(--text)',
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🧾 À payer</h2>
        <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => { setDraft(draft ? null : emptyDraft()); setMsg('') }}>
          {draft ? 'Annuler' : '+ Facture fournisseur'}
        </button>
      </div>

      {/* Reste à payer par fournisseur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {summary.map(g => {
          const key = g.name === 'Artisans / autres' ? OTHER : g.name
          const active = filterSupplier === key
          return (
            <button key={g.name} type="button" className="stat-card" onClick={() => { setFilterSupplier(active ? '' : key); setFilterStatus('todo') }}
              style={{ textAlign: 'left', cursor: 'pointer', border: active ? '2px solid var(--terracotta)' : undefined, background: 'white' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-light, #888)' }}>{g.name}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: g.total ? 'var(--terracotta)' : '#999' }}>{fmt(g.total)} DHS</div>
              <div style={{ fontSize: '0.75rem', color: g.late ? '#c0392b' : '#999' }}>
                {g.count ? `${g.count} facture${g.count > 1 ? 's' : ''}${g.late ? ' · en retard' : ''}` : 'Rien à payer'}
              </div>
            </button>
          )
        })}
        <div className="stat-card" style={{ background: '#FFFBF7' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888' }}>Total à payer</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{fmt(totalTodo)} DHS</div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', background: msg.startsWith('✓') ? '#EAF7EE' : '#FDECEA', color: msg.startsWith('✓') ? '#1e7e34' : '#c0392b', fontSize: '0.85rem' }}>{msg}</div>}

      {draft && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{draft.id ? 'Modifier la facture' : 'Nouvelle facture fournisseur'}</h3>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {PAYABLE_SUPPLIERS.map(s => (
              <button key={s.name} type="button" style={chip(draft.pick === s.name)} onClick={() => setDraft({ ...draft, pick: s.name, category: s.category })}>{s.name}</button>
            ))}
            <button type="button" style={chip(draft.pick === OTHER)} onClick={() => setDraft({ ...draft, pick: OTHER, category: PAYABLE_OTHER_CATEGORY })}>✏️ Artisan / autre</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            {draft.pick === OTHER && (
              <div>
                <label style={label}>Nom du fournisseur *</label>
                <input className="form-input" list="payable-others" value={draft.other} placeholder="ex : Menuisier Hassan" onChange={e => setDraft({ ...draft, other: e.target.value })} />
                <datalist id="payable-others">{otherNames.map(n => <option key={n} value={n} />)}</datalist>
              </div>
            )}
            <div>
              <label style={label}>Montant *</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                <select className="form-input" style={{ width: 'auto' }} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })}>
                  <option value="MAD">DHS</option><option value="EUR">€</option>
                </select>
              </div>
            </div>
            <div>
              <label style={label}>Date de la facture</label>
              <input className="form-input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div>
              <label style={label}>À payer avant le</label>
              <input className="form-input" type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} />
            </div>
            <div>
              <label style={label}>N° de facture</label>
              <input className="form-input" value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} />
            </div>
            <div>
              <label style={label}>Catégorie</label>
              <select className="form-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <label style={label}>Description</label>
            <input className="form-input" value={draft.description} placeholder="ex : excursions octobre, livraison du 12/10…" onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setDraft({ ...draft, file: e.target.files?.[0] || null })} />
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>📎 {draft.file ? draft.file.name : 'Joindre la facture (photo ou PDF)'}</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : draft.id ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </div>
      )}

      <div className="card filters-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'todo' | 'paid' | '')}>
          <option value="todo">À payer</option><option value="paid">Réglées</option><option value="">Toutes</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">Tous les fournisseurs</option>
          {PAYABLE_SUPPLIERS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          <option value={OTHER}>Artisans / autres</option>
        </select>
        <DateRangeFilter value={range} onChange={setRange} />
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 600 }}>{shown.length} facture{shown.length > 1 ? 's' : ''} · {fmt(shownTotal)} DHS</span>
      </div>

      <div className="card table-scroll" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: '1rem', color: '#888' }}>Chargement…</div> : shown.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888' }}>{filterStatus === 'todo' ? 'Aucune facture à payer 🎉' : 'Aucune facture'}</div>
        ) : (
          <table className="table-dep" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAF6F2', textAlign: 'left' }}>
                <th>Fournisseur</th><th>Date</th><th>N°</th><th className="col-wrap">Description</th><th>Échéance</th>
                <th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #f0e8e0', background: overdue(p) ? '#FFF5F4' : undefined }}>
                  <td style={{ fontWeight: 600 }}>{p.supplier}<div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 400 }}>{p.category}</div></td>
                  <td>{dmy(p.date)}</td>
                  <td>{p.reference || '—'}</td>
                  <td className="col-wrap">{p.description || ''}</td>
                  <td style={{ color: overdue(p) ? '#c0392b' : undefined, fontWeight: overdue(p) ? 700 : undefined }}>{p.due_date ? dmy(p.due_date) : '—'}{overdue(p) && ' ⚠️'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(Number(p.amount))} {p.currency === 'EUR' ? '€' : 'DHS'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.status === 'paid'
                      ? <span style={{ color: '#1e7e34', fontWeight: 600 }}>✓ Réglée le {dmy(p.paid_date)}<div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 400 }}>{p.payment}</div></span>
                      : <span style={{ color: 'var(--terracotta)', fontWeight: 600 }}>À payer</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {!!p.has_file && <button title="Voir la facture" onClick={() => view(p)} style={iconBtn}>📎</button>}
                    {p.status === 'todo'
                      ? <button className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => { setPayFor(p); setPayDate(today()); setPayMode('Virement'); setPayLoc('coffre') }}>💸 Payer</button>
                      : <button title="Annuler le règlement" onClick={() => unpay(p)} style={iconBtn}>↩️</button>}
                    <button title="Modifier" onClick={() => edit(p)} style={iconBtn}>✏️</button>
                    {p.status === 'todo' && <button title="Supprimer" onClick={() => remove(p)} style={iconBtn}>🗑️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {payFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>💸 Régler {payFor.supplier}</h3>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--terracotta)', marginBottom: '0.75rem' }}>{fmt(Number(payFor.amount))} {payFor.currency === 'EUR' ? '€' : 'DHS'}</div>
            <label style={label}>Date du règlement</label>
            <input className="form-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ marginBottom: '0.75rem' }} />
            <label style={label}>Mode de paiement</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {PAYMENTS.map(m => <button key={m} type="button" style={chip(payMode === m)} onClick={() => setPayMode(m)}>{m}</button>)}
            </div>
            {payMode === 'Espèces' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button type="button" style={chip(payLoc === 'coffre')} onClick={() => setPayLoc('coffre')}>🔐 Coffre fort</button>
                <button type="button" style={chip(payLoc === 'fonds')} onClick={() => setPayLoc('fonds')}>💰 Fond de caisse</button>
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 0.75rem' }}>
              La dépense sera ajoutée automatiquement dans Dépenses{payMode === 'Espèces' ? (payLoc === 'coffre' ? ' et le Coffre fort' : ' et le Fond de caisse') : ' et la Banque'}, avec la facture pour le comptable.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPayFor(null)}>Annuler</button>
              <button className="btn-primary" disabled={saving} onClick={pay}>{saving ? '…' : 'Valider le règlement'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.3rem' }
