import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'mgr_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'riad-anyssates-secret-2026'

function hashPin(pin: string): string {
  // Simple deterministic hash for session validation
  let hash = 0
  const str = pin + SESSION_SECRET
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function createSessionToken(pin: string): string {
  return hashPin(pin)
}

export function validateSessionToken(token: string, pin: string): boolean {
  return token === hashPin(pin)
}

export async function getManagerSession(): Promise<boolean> {
  const cookieStore = cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  if (!session) return false
  // We store the hashed PIN in the cookie; valid if it exists
  return session.value.length > 0
}

export function getSessionFromRequest(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value || null
}

export { SESSION_COOKIE }
