import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let sql = `
    SELECT p.id, p.nome_canonico, p.tipo_entidade, p.especialidade,
           COUNT(DISTINCT pa.id) as aliases_count
    FROM prescritores p
    LEFT JOIN prescritor_aliases pa ON pa.prescritor_id = p.id
  `
  const params: unknown[] = []
  if (q) { sql += ` WHERE p.nome_canonico LIKE ?`; params.push(`%${q}%`) }
  sql += ` GROUP BY p.id ORDER BY p.nome_canonico LIMIT 100`

  const prescritores = db.prepare(sql).all(...params)
  return NextResponse.json(prescritores)
}

export async function PUT(req: NextRequest) {
  const { id, nome_canonico, tipo_entidade, especialidade } = await req.json()
  const db = getDb()
  db.prepare(`UPDATE prescritores SET nome_canonico = ?, tipo_entidade = ?, especialidade = ? WHERE id = ?`)
    .run(nome_canonico, tipo_entidade, especialidade, id)
  return NextResponse.json({ ok: true })
}
