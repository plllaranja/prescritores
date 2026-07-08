import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyPassword, setSession, SessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()
  if (!email || !senha) return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })

  const db = getDb()
  const user = db.prepare(`
    SELECT u.id, u.nome, u.email, u.senha_hash, u.role, u.representante_id, u.ativo
    FROM usuarios u WHERE u.email = ?
  `).get(email.toLowerCase().trim()) as {
    id: number; nome: string; email: string; senha_hash: string
    role: 'admin' | 'rep'; representante_id: number | null; ativo: number
  } | undefined

  if (!user || !user.ativo) {
    return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 401 })
  }

  const ok = await verifyPassword(senha, user.senha_hash)
  if (!ok) return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })

  const session: SessionUser = {
    id: user.id, nome: user.nome, email: user.email,
    role: user.role, representante_id: user.representante_id,
  }
  await setSession(session)
  return NextResponse.json({ ok: true, user: session })
}
