import webpush from 'web-push'
import sql from '@/lib/db'

// Clés VAPID des notifications push : générées une seule fois puis gardées dans la table settings
// (pas de variable d'environnement à configurer).
let vapidCache: { publicKey: string; privateKey: string } | null = null

export async function getVapidKeys() {
  if (vapidCache) return vapidCache
  let rows = await sql`SELECT key, value FROM settings WHERE key IN ('vapid_public', 'vapid_private')`
  let pub = rows.find(r => r.key === 'vapid_public')?.value as string | undefined
  let priv = rows.find(r => r.key === 'vapid_private')?.value as string | undefined
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys()
    await sql`INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid_public', ${keys.publicKey})`
    await sql`INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid_private', ${keys.privateKey})`
    rows = await sql`SELECT key, value FROM settings WHERE key IN ('vapid_public', 'vapid_private')`
    pub = rows.find(r => r.key === 'vapid_public')?.value as string
    priv = rows.find(r => r.key === 'vapid_private')?.value as string
  }
  vapidCache = { publicKey: pub, privateKey: priv }
  return vapidCache
}

const fmtNum = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtAmount = (n: unknown, cur?: unknown) => `${fmtNum(Number(n) || 0)} ${cur || 'MAD'}`

// Enregistre une notification (cloche de l'interface manager) et l'envoie en push
// aux appareils des administrateurs, sauf à la personne qui a fait l'action.
// Ne lève jamais d'erreur : une notification ratée ne doit pas bloquer la saisie.
export async function notify(n: { kind: string; title: string; body?: string; actor?: string; url?: string }) {
  try {
    const url = n.url || '/manager'
    await sql`INSERT INTO notifications (kind, title, body, actor, url) VALUES (${n.kind}, ${n.title}, ${n.body || null}, ${n.actor || null}, ${url})`

    const subs = await sql`SELECT endpoint, p256dh, auth, manager_name FROM push_subs`
    const targets = subs.filter(s => !n.actor || s.manager_name !== n.actor)
    if (targets.length === 0) return
    const { publicKey, privateKey } = await getVapidKeys()
    webpush.setVapidDetails('mailto:contact@riadanyssates.com', publicKey, privateKey)
    const payload = JSON.stringify({ title: n.title, body: n.body || '', url, tag: n.kind })
    await Promise.allSettled(targets.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          payload,
          { TTL: 60 * 60 * 24, timeout: 8000 },
        )
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        // Abonnement expiré ou révoqué : on l'oublie
        if (code === 404 || code === 410) await sql`DELETE FROM push_subs WHERE endpoint = ${s.endpoint}`
        else console.error('push error', code, err)
      }
    }))
  } catch (err) {
    console.error('notify error:', err)
  }
}
