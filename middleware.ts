import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-token'

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/cadastro']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Deixa rotas públicas e assets passarem
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const user = await getSessionFromRequest(req)

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Reps não acessam rotas de admin
  if (user.role === 'rep' && pathname.startsWith('/api/auth/cadastro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

