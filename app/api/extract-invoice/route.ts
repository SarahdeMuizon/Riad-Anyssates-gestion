import { NextRequest, NextResponse } from 'next/server'
import { getManagerSession } from '@/lib/auth'
import sql from '@/lib/db'
 
export const dynamic = 'force-dynamic'
 
export async function POST(req: NextRequest) {
  // Accept manager session OR employee token
  const isManager = await getManagerSession()
  if (!isManager) {
    // Check employee token from header or form
    const token = req.headers.get('x-employee-token')
    if (token) {
      const emp = await sql`SELECT id FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    } else {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }
 
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
 
  const form = await req.formData()
  const file = form.get('file') as File | null
  const entryType = form.get('type') as string // 'cb' or 'cash'
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
 
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
 
  let mediaType = file.type
  if (!mediaType || mediaType === 'application/octet-stream') {
    mediaType = file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
  }
 
  const isImage = mediaType.startsWith('image/')
  const isPdf = mediaType === 'application/pdf'
 
  if (!isImage && !isPdf) {
    return NextResponse.json({ error: 'Format non supporté (image ou PDF uniquement)' }, { status: 400 })
  }
 
  const DEPENSES_CATEGORIES = ['Client','Commission','Administratif','Nourriture','Spa','Prestataire','Banque','Salaire','Maroc Telecom','Travaux','Radeema','Divers']
 
  const prompt = entryType === 'cb'
    ? `Analyse cette facture/reçu. Réponds UNIQUEMENT avec un JSON strict (aucun texte autour).
 
Si c'est un ticket de supermarché/épicerie/grande surface avec plusieurs produits, détecte les catégories présentes et utilise ce format :
{
  "date": "YYYY-MM-DD ou null",
  "supplier": "nom du magasin ou null",
  "amount_ttc": montant total en nombre décimal ou null,
  "is_supermarche": true,
  "items": [
    {"category": "une des catégories ci-dessous", "amount": nombre décimal, "label": "description courte"}
  ]
}
 
Sinon (facture normale), utilise ce format :
{
  "date": "YYYY-MM-DD ou null",
  "supplier": "nom du fournisseur ou null",
  "amount_ht": nombre décimal ou null,
  "tva_rate": taux TVA en % (ex: 20) ou null,
  "amount_ttc": montant total TTC en nombre décimal ou null,
  "is_supermarche": false
}
 
Catégories disponibles : ${DEPENSES_CATEGORIES.join(', ')}.
Pour les supermarché : regroupe les produits par catégorie (ex: légumes/viande/épicerie → "Nourriture", produits d'entretien/fournitures → "Administratif").
Si une information n'est pas visible, mets null. Réponds UNIQUEMENT avec le JSON.`
    : `Analyse ce ticket CB/reçu et extrait en JSON strict :
{
  "date": "YYYY-MM-DD ou null",
  "supplier": "nom établissement ou null",
  "amount_ttc": montant total en nombre décimal ou null
}
Réponds UNIQUEMENT avec le JSON.`
 
  const contentItem = isImage
    ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
 
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [contentItem, { type: 'text', text: prompt }],
        }],
      }),
    })
 
    if (!r.ok) {
      const err = await r.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'Erreur API extraction' }, { status: 500 })
    }
 
    const data = await r.json()
    const text: string = data.content?.[0]?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({})
    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json(extracted)
  } catch (err) {
    console.error('Extract invoice error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
 
