import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_SECRET, SESSION_TTL, type SessionUser } from './session-token'

export type { SessionUser } from './session-token'

// ── Token ──────────────────────────────────────────────────────────────────

function signToken(payload: SessionUser): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL * 1000 })).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verifyToken(token: string): SessionUser | null {
  try {
    const [data, sig] = token.split('.')
    const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionUser & { exp?: number }
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

// ── Password ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs') as { hash: (p: string, r: number) => Promise<string>; compare: (p: string, h: string) => Promise<boolean> }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── Session ────────────────────────────────────────────────────────────────

export async function setSession(user: SessionUser): Promise<void> {
  const token = signToken(user)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export function generateSenhaTemp(): string {
  return randomBytes(6).toString('hex')
}
