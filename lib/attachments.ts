// Les justificatifs sont stockés en « data URL » (data:image/jpeg;base64,…).
// Les navigateurs bloquent l'ouverture directe de ces adresses dans un nouvel onglet :
// on les convertit en fichier temporaire (blob) avant de les ouvrir.

export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',')
  const meta = url.slice(5, comma) // ex : "image/jpeg;base64"
  const mime = meta.split(';')[0] || 'application/octet-stream'
  const isBase64 = meta.includes(';base64')
  const data = url.slice(comma + 1)
  if (!isBase64) return new Blob([decodeURIComponent(data)], { type: mime })
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function openAttachment(url: string | null | undefined) {
  if (!url) return
  if (!url.startsWith('data:')) { window.open(url, '_blank', 'noopener'); return }
  const blobUrl = URL.createObjectURL(dataUrlToBlob(url))
  const w = window.open(blobUrl, '_blank')
  // Bloqueur de fenêtres (ex : iPhone) : on ouvre dans l'onglet courant
  if (!w) window.location.href = blobUrl
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
