import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const pendentes = db.prepare(`
    SELECT m.id, m.nome_visita, m.nome_candidato, m.score, m.upload_id, m.criado_em,
           p.id as prescritor_id, p.nome_canonico
    FROM matches_pendentes m
    LEFT JOIN prescritores p ON p.nome_canonico = m.nome_candidato
    WHERE m.resolvido = 0
    ORDER BY m.score DESC
  `).all()
  return NextResponse.json(pendentes)
}

export async function POST(req: NextRequest) {
  const { id, acao, prescritor_id } = await req.json()
  const db = getDb()

  const match = db.prepare('SELECT * FROM matches_pendentes WHERE id = ?').get(id) as {
    id: number; nome_visita: string; nome_candidato: string; score: number
  } | undefined

  if (!match) return NextResponse.json({ error: 'Match não encontrado' }, { status: 404 })

  if (acao === 'confirmar') {
    const pid = prescritor_id ?? db.prepare('SELECT id FROM prescritores WHERE nome_canonico = ?').get(match.nome_candidato) as { id: number } | undefined
    const finalPid = typeof pid === 'number' ? pid : (pid as { id: number })?.id
    if (!finalPid) return NextResponse.json({ error: 'Prescritor não encontrado' }, { status: 404 })

    db.prepare('UPDATE matches_pendentes SET resolvido = 1, resolucao = ?, prescritor_id_escolhido = ? WHERE id = ?').run('confirmado', finalPid, id)
    db.prepare('UPDATE visitas SET prescritor_id = ?, match_confirmado = 1 WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL').run(finalPid, match.nome_visita)
    db.prepare('INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, ?, 1)').run(finalPid, match.nome_visita, 'visita')

  } else if (acao === 'rejeitar') {
    db.prepare('UPDATE matches_pendentes SET resolvido = 1, resolucao = ? WHERE id = ?').run('rejeitado', id)

  } else if (acao === 'manual' && prescritor_id) {
    db.prepare('UPDATE matches_pendentes SET resolvido = 1, resolucao = ?, prescritor_id_escolhido = ? WHERE id = ?').run('manual', prescritor_id, id)
    db.prepare('UPDATE visitas SET prescritor_id = ?, match_confirmado = 1 WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL').run(prescritor_id, match.nome_visita)
    db.prepare('INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, ?, 1)').run(prescritor_id, match.nome_visita, 'visita')
  }

  return NextResponse.json({ ok: true })
}
