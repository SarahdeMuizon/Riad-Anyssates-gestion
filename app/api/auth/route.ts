import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    if (!pin) {
      return NextResponse.json({ error: 'PIN requis' }, { status: 400 })
    }

    const rows = await sql`SELECT value FROM settings WHERE key = 'pin'`
    const storedPin = rows[0]?.value as string | undefined

    if (pin !== storedPin) {
      return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 })
    }

    const token = createSessionToken(pin)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return response
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
