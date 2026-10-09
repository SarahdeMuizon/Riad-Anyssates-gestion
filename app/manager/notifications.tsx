'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Notif = { id: number; kind: string; title: string; body: string | null; actor: string | null; created_at: string }

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function timeAgo(utc: string) {
  const d = new Date(utc.replace(' ', 'T') + 'Z')
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const ICON: Record<string, string> = { entry: '🧾', fonds: '💰', coffre: '🔐', rapprochement: '🔍' }

// Cloche de notifications de l'interface manager + activation des notifications push sur l'appareil
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [lastSeen, setLastSeen] = useState(0)
  const [me, setMe] = useState('')
  const [pushState, setPushState] = useState<'unsupported' | 'ios-home' | 'off' | 'on' | 'denied' | 'busy'>('off')
  const [pushMsg, setPushMsg] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null)
    if (!r || !r.ok) return
    const d = await r.json()
    setItems(d.items || []); setUnread(d.unread || 0); setLastSeen(d.lastSeen || 0); setMe(d.me || '')
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  // État des notifications push sur cet appareil
  useEffect(() => {
    (async () => {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
        setPushState(isIos && !standalone ? 'ios-home' : 'unsupported'); return
      }
      if (Notification.permission === 'denied') { setPushState('denied'); return }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          setPushState('on')
          // Ré-enregistre l'abonnement côté serveur (au cas où il aurait été perdu)
          fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => {})
        } else setPushState('off')
      } catch { setPushState('unsupported') }
    })()
  }, [])

  // Ferme le panneau au clic à l'extérieur
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      await fetch('/api/notifications', { method: 'POST' }).catch(() => {})
    }
  }

  async function enablePush() {
    setPushState('busy'); setPushMsg('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const { publicKey } = await fetch('/api/push').then(r => r.json())
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })
      if (!r.ok) throw new Error('save')
      setPushState('on'); setPushMsg('✓ Notifications activées sur cet appareil')
    } catch (err) {
      console.error(err)
      setPushState('off'); setPushMsg("Impossible d'activer les notifications — réessayez.")
    }
  }

  async function disablePush() {
    setPushState('busy')
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
    } catch { /* ignore */ }
    setPushState('off'); setPushMsg('Notifications désactivées sur cet appareil')
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={toggle} title="Notifications" aria-label="Notifications"
        style={{ position: 'relative', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, background: '#DC2626', color: 'white', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--terracotta)' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 360, maxWidth: 'calc(100vw - 24px)', maxHeight: '70vh', overflowY: 'auto', background: 'white', color: 'var(--text)', borderRadius: '0.6rem', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', zIndex: 200 }}>
          <div style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid #EDE0D6', fontWeight: 700, fontSize: '0.95rem' }}>Notifications</div>

          <div style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid #EDE0D6', background: '#FAF7F4', fontSize: '0.8rem' }}>
            {pushState === 'on' && <span>📱 Notifications actives sur cet appareil · <button onClick={disablePush} style={{ background: 'none', border: 'none', color: '#888', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>désactiver</button></span>}
            {(pushState === 'off' || pushState === 'busy') && (
              <button onClick={enablePush} disabled={pushState === 'busy'} style={{ background: 'var(--terracotta)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                {pushState === 'busy' ? 'Activation…' : '📱 Recevoir les notifications sur cet appareil'}
              </button>
            )}
            {pushState === 'denied' && <span style={{ color: '#B45309' }}>Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.</span>}
            {pushState === 'ios-home' && <span style={{ color: '#555' }}>Sur iPhone : touchez Partager puis « Sur l&apos;écran d&apos;accueil », ouvrez l&apos;appli depuis l&apos;icône, puis revenez ici pour activer les notifications.</span>}
            {pushState === 'unsupported' && <span style={{ color: '#888' }}>Ce navigateur ne permet pas les notifications push.</span>}
            {pushMsg && <div style={{ marginTop: '0.35rem', color: '#555' }}>{pushMsg}</div>}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>Aucune notification</div>
          ) : items.map(n => {
            const isNew = n.id > lastSeen && n.actor !== me
            return (
              <div key={n.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.9rem', borderBottom: '1px solid #F3ECE5', background: isNew ? '#FFF7F2' : 'white' }}>
                <div style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{ICON[n.kind] || '•'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: isNew ? 700 : 600 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.1rem' }}>{n.body}</div>}
                  <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '0.15rem' }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
