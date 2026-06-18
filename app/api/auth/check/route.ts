import { NextResponse } from 'next/server'
import { getManagerSession } from '@/lib/auth'

export async function GET() {
  const isAuth = await getManagerSession()
  if (!isAuth) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true })
}
