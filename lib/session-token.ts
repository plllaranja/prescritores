import type { NextRequest } from 'next/server'

export const SESSION_COOKIE = 'lf_session'
export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'lf-prescritores-secret-change-in-prod'
export const SESSION_TTL = 60 * 60 * 24 * 7

export interface SessionUser {
  id: number
  nome: string
  email: string
  role: 'admin' | 'rep'
  representante_id: number | null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function hmacSha256Base64Url(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export async function verifySessionTokenEdge(token: string): Promise<SessionUser | null> {
  try {
    const [data, sig] = token.split('.')
    if (!data || !sig) return null
    const expected = await hmacSha256Base64Url(data)
    if (!timingSafeEqual(sig, expected)) return null
    const payload = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/'))) as SessionUser & { exp?: number }
    if (!payload.exp || payload.exp < Date.now()) return null
    return {
      id: payload.id,
      nome: payload.nome,
      email: payload.email,
      role: payload.role,
      representante_id: payload.representante_id,
    }
  } catch {
    return null
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionTokenEdge(token)
}
