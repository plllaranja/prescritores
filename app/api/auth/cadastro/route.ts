import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, getSession } from '@/lib/auth'

export async function GET() {
  // Verifica se já existe algum usuário (para controle do primeiro cadastro)
  const count = (getDb().prepare('SELECT COUNT(*) as n FROM usuarios').get() as { n: number }).n
  return NextResponse.json({ has_users: count > 0 })
}

export async function POST(req: NextRequest) {
  const db = getDb()

  // Primeiro usuário: qualquer pessoa pode criar (setup inicial)
  // Usuários subsequentes: apenas admin logado
  const count = (db.prepare('SELECT COUNT(*) as n FROM usuarios').get() as { n: number }).n
  if (count > 0) {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
  }

  const { nome, email, senha, role, representante_id } = await req.json()
  if (!nome || !email || !senha) {
    return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'Senha mínima de 6 caracteres' }, { status: 400 })
  }

  const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase().trim())
  if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })

  const hash = await hashPassword(senha)
  const result = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, role, representante_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(nome.trim(), email.toLowerCase().trim(), hash, role ?? 'rep', representante_id ?? null)

  return NextResponse.json({ ok: true, id: result.lastInsertRowid })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const { id, nome, email, role, representante_id, ativo, senha } = await req.json()
  const db = getDb()

  if (senha) {
    const hash = await hashPassword(senha)
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, id)
  }
  db.prepare(`UPDATE usuarios SET nome = ?, email = ?, role = ?, representante_id = ?, ativo = ? WHERE id = ?`)
    .run(nome, email.toLowerCase().trim(), role, representante_id ?? null, ativo ? 1 : 0, id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (id === session.id) return NextResponse.json({ error: 'Não pode excluir a si mesmo' }, { status: 400 })
  getDb().prepare('DELETE FROM usuarios WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
