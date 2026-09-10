import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
 
// DELETE — vide uniquement les entrées saisies (Encaissements, Dépenses,
// Fond de caisse, Coffre). Contrairement à /api/settings/reset, celui-ci NE
// touche PAS aux employés, au PIN, ni aux soldes de départ (fond de caisse /
// solde bancaire) configurés dans les Paramètres.
export async function DELETE() {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
 
    await sql`DELETE FROM entries`
    await sql`DELETE FROM fonds_entries`
    await sql`DELETE FROM coffre_entries`
 
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reset entries error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
