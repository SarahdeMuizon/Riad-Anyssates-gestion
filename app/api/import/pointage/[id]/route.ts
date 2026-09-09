import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'
 
export const dynamic = 'force-dynamic'
 
// GET — télécharge le fichier Excel pointé archivé
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    const id = parseInt(params.id)
    const rows = await sql`SELECT filename, file_base64 FROM excel_pointage_imports WHERE id = ${id}`
    if (!rows[0]) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
 
    const buffer = Buffer.from(rows[0].file_base64 as string, 'base64')
    const filename = (rows[0].filename as string) || `pointage-${id}.xlsx`
 
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET import pointage archive error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
// DELETE — supprime une archive
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const isAuth = await getManagerSession()
    if (!isAuth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
 
    await sql`DELETE FROM excel_pointage_imports WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE import pointage archive error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
 
