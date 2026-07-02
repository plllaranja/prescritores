import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const reps = db.prepare(`
    SELECT r.id, r.nome, r.territorio, r.visitas_por_dia, r.ativo, r.pendente_configuracao,
           COUNT(DISTINCT v.prescritor_id) as prescritores_carteira,
           COUNT(v.id) as total_visitas
    FROM representantes r
    LEFT JOIN visitas v ON v.representante_id = r.id
    GROUP BY r.id
    ORDER BY r.nome
  `).all()
  return NextResponse.json(reps)
}

export async function PUT(req: NextRequest) {
  const { id, nome, territorio, visitas_por_dia, ativo } = await req.json()
  const db = getDb()
  db.prepare(`
    UPDATE representantes SET nome = ?, territorio = ?, visitas_por_dia = ?, ativo = ?, pendente_configuracao = 0
    WHERE id = ?
  `).run(nome, territorio, visitas_por_dia ?? 6, ativo ?? 1, id)
  return NextResponse.json({ ok: true })
}
