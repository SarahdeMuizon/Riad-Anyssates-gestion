'use client'
// Factures de vente (encaissements clients) et relevé trimestriel de la taxe de séjour
import { useEffect, useMemo, useState, useCallback } from 'react'
import type { Entry } from '@/types'
import { computeInvoice, entryGross, quarterOf, QUARTER_LABELS, type Invoice } from '@/lib/invoice'

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadInvoice(inv: Invoice) {
  const { buildInvoicePdf } = await import('@/lib/invoice-pdf')
  saveBlob(await buildInvoicePdf(inv), `Facture ${inv.number}${inv.client_name ? ` - ${inv.client_name}` : ''}.pdf`)
}

// Factures et tarif de taxe de séjour, rechargeables après une création / modification
export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [taxRate, setTaxRate] = useState<number | null>(null)
  const [taxCurrency, setTaxCurrency] = useState('EUR')
  const reload = useCallback(async () => {
    const [inv, rate] = await Promise.all([
      fetch('/api/invoices', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/settings/taxe-sejour', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setInvoices(Array.isArray(inv) ? inv : [])
    if (rate?.taxe_sejour_tarif !== undefined) setTaxRate(Number(rate.taxe_sejour_tarif))
    if (rate?.taxe_sejour_devise) setTaxCurrency(rate.taxe_sejour_devise)
  }, [])
  useEffect(() => { reload() }, [reload])
  const byEntry = useMemo(() => {
    const m: Record<number, Invoice> = {}
    for (const i of invoices) if (i.entry_id) m[i.entry_id] = i
    return m
  }, [invoices])
  return { invoices, byEntry, taxRate, taxCurrency, reload }
}

// ─── Création / modification d'une facture ────────────────────────────────────

export function InvoiceModal({ entry, invoice, taxRate, taxCurrency, onClose, onSaved }: {
  entry: Entry | null
  invoice: Invoice | null
  taxRate: number
  taxCurrency: string
  onClose: () => void
  onSaved: (inv: Invoice | null) => void
}) {
  const [clientName, setClientName] = useState(invoice?.client_name ?? entry?.supplier ?? '')
  const [date, setDate] = useState(invoice?.date ?? entry?.date ?? new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState(invoice?.description ?? 'Hébergement')
  const [nights, setNights] = useState(invoice ? String(invoice.nights) : '')
  const [persons, setPersons] = useState(invoice ? String(invoice.persons) : '')
  const [taxIncluded, setTaxIncluded] = useState(invoice ? !!invoice.tax_included : true)
  const [tvaRate, setTvaRate] = useState(invoice ? String(invoice.tva_rate || '') : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currency = invoice?.currency ?? entry?.currency ?? 'MAD'
  const rate = invoice ? Number(invoice.tax_rate) : taxRate
  const taxCur = invoice ? (invoice.tax_currency || 'MAD') : taxCurrency
  const gross = invoice ? Number(invoice.tax_included ? invoice.amount_total : invoice.amount_lodging) : entry ? entryGross(entry) : 0
  const c = computeInvoice({ gross, currency, nights: Number(nights), persons: Number(persons), taxRate: rate, taxCurrency: taxCur, taxIncluded, tvaRate: parseFloat(tvaRate) || 0 })

  async function save(andDownload: boolean) {
    setSaving(true); setError('')
    const body = { entry_id: entry?.id, client_name: clientName, date, description, nights: c.nights, persons: c.persons, tax_included: taxIncluded, tva_rate: parseFloat(tvaRate) || 0 }
    const r = await fetch(invoice ? `/api/invoices/${invoice.id}` : '/api/invoices', {
      method: invoice ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!r || !r.ok) { setError(d.error || 'Erreur — réessayez.'); setSaving(false); return }
    if (andDownload) await downloadInvoice(d as Invoice).catch(() => setError('Facture enregistrée, mais le PDF n’a pas pu être créé.'))
    setSaving(false)
    onSaved(d as Invoice)
  }

  async function remove() {
    if (!invoice || !confirm(`Supprimer la facture ${invoice.number} ?`)) return
    setSaving(true); setError('')
    const r = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setSaving(false)
    if (!r || !r.ok) { setError(d.error || 'Erreur — réessayez.'); return }
    onSaved(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#8B4513', marginBottom: '0.25rem' }}>
          {invoice ? `🧾 Facture ${invoice.number}` : '🧾 Nouvelle facture'}
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          {invoice ? 'Le numéro reste inchangé.' : 'Le numéro est attribué automatiquement à l’enregistrement.'}
          {' '}Montant encaissé : <strong>{fmt(gross)} {currency}</strong>{entry?.payment ? ` (${entry.payment})` : ''}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Client</label>
            <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nom du client" />
          </div>
          <div>
            <label style={label}>Date de la facture</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Prestation</label>
            <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={label}>Nombre de nuits</label>
            <input className="form-input" type="number" min="0" step="1" inputMode="numeric" value={nights} onChange={e => setNights(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div>
            <label style={label}>Nombre de personnes</label>
            <input className="form-input" type="number" min="0" step="1" inputMode="numeric" value={persons} onChange={e => setPersons(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div style={{ background: '#FAF6F2', border: '1px solid #EADBCB', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.875rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxe de séjour : {c.nights} nuit{c.nights > 1 ? 's' : ''} × {c.persons} pers. × {fmt(rate)} {taxCur}</span>
            <strong style={{ color: '#8B4513' }}>{fmt(c.taxAmount)} {taxCur}</strong>
          </div>
          {c.mixable ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
              <input type="checkbox" checked={taxIncluded} onChange={e => setTaxIncluded(e.target.checked)} style={{ accentColor: '#8B4513' }} />
              Taxe comprise dans le montant encaissé
            </label>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Encaissement en {currency} : la taxe (en {taxCur}) figure sur la facture hors total.</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            TVA sur la prestation
            <input className="form-input" type="number" min="0" step="0.1" value={tvaRate} onChange={e => setTvaRate(e.target.value)} placeholder="0" style={{ width: '4.5rem', padding: '0.2rem 0.4rem' }} /> %
          </div>
          <div style={{ borderTop: '1px solid #EADBCB', marginTop: '0.2rem', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{description || 'Prestation'}{c.tva > 0 ? ' (HT)' : ''}</span><span>{fmt(c.lodgingHT)} {currency}</span></div>
            {c.tva > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA {tvaRate} %</span><span>{fmt(c.tva)} {currency}</span></div>}
            {c.taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxe de séjour</span><span>{fmt(c.taxAmount)} {taxCur}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#8B4513', fontSize: '0.95rem' }}><span>Total facture</span><span>{fmt(c.total)} {currency}</span></div>
          </div>
          {c.lodging < 0 && <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.8rem' }}>La taxe de séjour dépasse le montant encaissé.</span>}
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Fermer</button>
          {invoice && <button onClick={remove} disabled={saving} title="Possible uniquement pour la dernière facture de l’année" style={{ background: 'none', border: '1px solid #fca5a5', color: 'var(--red)', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' }}>Supprimer</button>}
          {invoice && <button className="btn-secondary" onClick={() => save(false)} disabled={saving || c.lodging < 0}>Enregistrer</button>}
          <button className="btn-primary" onClick={() => save(true)} disabled={saving || c.lodging < 0} style={{ marginLeft: 'auto', background: '#8B4513' }}>
            {saving ? 'Enregistrement…' : invoice ? '📄 Enregistrer et télécharger' : '📄 Créer la facture'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Relevé trimestriel de la taxe de séjour ──────────────────────────────────
// Taxe = nombre de personnes × nombre de nuits × tarif (2,5 par défaut)

export function TaxeSejourPanel() {
  const { invoices, taxRate, taxCurrency, reload } = useInvoices()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [rateInput, setRateInput] = useState('')
  const [curInput, setCurInput] = useState('EUR')
  const [rateMsg, setRateMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)

  useEffect(() => { if (taxRate !== null) setRateInput(String(taxRate)) }, [taxRate])
  useEffect(() => { setCurInput(taxCurrency) }, [taxCurrency])

  const rows = useMemo(() => invoices
    .filter(i => Number(i.tax_amount) > 0 && Number(i.date.substring(0, 4)) === year && quarterOf(i.date) === quarter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq), [invoices, year, quarter])
  const persons = rows.reduce((t, i) => t + i.persons, 0)
  const nuitees = rows.reduce((t, i) => t + i.nights * i.persons, 0)
  const taxTotals = rows.reduce<Record<string, number>>((t, i) => {
    const c = i.tax_currency || 'MAD'
    t[c] = (t[c] || 0) + Number(i.tax_amount)
    return t
  }, {})
  const taxTotalLabel = Object.keys(taxTotals).length
    ? Object.entries(taxTotals).map(([c, v]) => `${fmt(v)} ${c}`).join(' + ')
    : `${fmt(0)} ${taxCurrency}`

  function shiftQuarter(d: number) {
    let q = quarter + d, y = year
    if (q < 1) { q = 4; y-- } else if (q > 4) { q = 1; y++ }
    setQuarter(q); setYear(y)
  }
  const isCurrent = year === now.getFullYear() && quarter === Math.floor(now.getMonth() / 3) + 1
  const settingsChanged = taxRate !== null && (rateInput !== String(taxRate) || curInput !== taxCurrency)

  async function saveRate() {
    setRateMsg('')
    const r = await fetch('/api/settings/taxe-sejour', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxe_sejour_tarif: rateInput, taxe_sejour_devise: curInput }) }).catch(() => null)
    setRateMsg(r && r.ok ? '✓ Tarif enregistré (nouvelles factures)' : 'Tarif invalide')
    if (r && r.ok) reload()
    setTimeout(() => setRateMsg(''), 4000)
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const { buildTaxeSejourPdf } = await import('@/lib/invoice-pdf')
      saveBlob(await buildTaxeSejourPdf(rows, year, quarter), `Taxe de séjour - T${quarter} ${year}.pdf`)
    } catch (err) { console.error(err) }
    setExporting(false)
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => shiftQuarter(-1)} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}>‹</button>
          <span style={{ fontWeight: 700, minWidth: 230, textAlign: 'center' }}>{QUARTER_LABELS[quarter]} {year}</span>
          <button onClick={() => shiftQuarter(1)} disabled={isCurrent} style={{ border: '1px solid #ddd', background: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.65rem', cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 0.4 : 1, fontWeight: 600 }}>›</button>
        </div>
        <button className="btn-primary" onClick={exportPdf} disabled={exporting || rows.length === 0} style={{ background: '#8B4513', fontSize: '0.85rem', padding: '0.4rem 0.9rem', opacity: rows.length === 0 ? 0.5 : 1 }}>
          {exporting ? 'Création…' : '📄 Relevé PDF'}
        </button>
        <a href={rows.length ? `/api/export/taxe-sejour?year=${year}&quarter=${quarter}` : undefined} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem', textDecoration: 'none', opacity: rows.length === 0 ? 0.5 : 1, pointerEvents: rows.length === 0 ? 'none' : 'auto' }}>📊 Excel</a>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#666', flexWrap: 'wrap' }}>
          Tarif :
          <input className="form-input" type="number" min="0" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)} style={{ width: '4.5rem', padding: '0.25rem 0.4rem' }} />
          <select className="form-input" value={curInput} onChange={e => setCurInput(e.target.value)} style={{ width: 'auto', padding: '0.25rem 0.4rem' }}>
            <option value="EUR">€</option>
            <option value="MAD">MAD</option>
          </select>
          par personne et par nuit
          {settingsChanged && <button className="btn-secondary" onClick={saveRate} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>OK</button>}
          {rateMsg && <span style={{ color: rateMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{rateMsg}</span>}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[['Personnes', String(persons)], ['Nuitées (personnes × nuits)', String(nuitees)], ['Taxe de séjour à reverser', taxTotalLabel]].map(([l, v], i) => (
          <div key={l} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{l}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: i === 2 ? '#8B4513' : 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
          Aucune taxe de séjour sur ce trimestre.<br />
          <span style={{ fontSize: '0.8rem' }}>Créez la facture client en ajoutant un encaissement (bouton « 🧾 Créer une facture client ») avec le nombre de personnes et de nuits.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table-dep">
            <thead>
              <tr><th>Date</th><th>N° facture</th><th>Client</th><th>Personnes</th><th>Nuits</th><th>Personnes × nuits</th><th>Taxe de séjour</th></tr>
            </thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(i.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td><button onClick={() => setEditing(i)} title="Ouvrir / corriger la facture" style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 600 }}>{i.number}</button></td>
                  <td className="col-wrap">{i.client_name || '—'}</td>
                  <td>{i.persons}</td>
                  <td>{i.nights}</td>
                  <td>{i.nights * i.persons}</td>
                  <td style={{ fontWeight: 600, color: '#8B4513', whiteSpace: 'nowrap' }}>{fmt(Number(i.tax_amount))} {i.tax_currency || 'MAD'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#FAF6F2' }}>
                <td colSpan={3}>Total du trimestre</td>
                <td>{persons}</td><td></td><td>{nuitees}</td>
                <td style={{ color: '#8B4513', whiteSpace: 'nowrap' }}>{taxTotalLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && taxRate !== null && (
        <InvoiceModal entry={null} invoice={editing} taxRate={taxRate} taxCurrency={taxCurrency} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </div>
  )
}
