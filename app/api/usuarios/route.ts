import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const usuarios = getDb().prepare(`
    SELECT id, nome, email, role, representante_id, ativo, criado_em
    FROM usuarios ORDER BY criado_em ASC
  `).all()
  return NextResponse.json(usuarios)
}
