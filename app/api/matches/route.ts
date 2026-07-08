import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { findBestMatch } from '@/lib/fuzzy-matcher'

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

// Reprocessar todos os links visitas → prescritores com threshold reduzido
export async function PUT() {
  const db = getDb()
  const THRESHOLD = 60  // mais permissivo que o padrão (85)

  const prescritores = db.prepare('SELECT id, nome_canonico FROM prescritores').all() as Array<{ id: number; nome_canonico: string }>

  // 1. Auto-confirmar matches_pendentes existentes (foram aprovados pelo score 70-85)
  const pendentes = db.prepare(`
    SELECT m.id, m.nome_visita, m.nome_candidato, p.id as pid
    FROM matches_pendentes m
    JOIN prescritores p ON p.nome_canonico = m.nome_candidato
    WHERE m.resolvido = 0
  `).all() as Array<{ id: number; nome_visita: string; nome_candidato: string; pid: number }>

  let confirmados = 0
  for (const m of pendentes) {
    db.prepare('UPDATE matches_pendentes SET resolvido = 1, resolucao = ?, prescritor_id_escolhido = ? WHERE id = ?').run('confirmado', m.pid, m.id)
    const updated = db.prepare('UPDATE visitas SET prescritor_id = ?, match_confirmado = 1 WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL').run(m.pid, m.nome_visita)
    db.prepare('INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, ?, 1)').run(m.pid, m.nome_visita, 'visita')
    confirmados += (updated as { changes: number }).changes
  }

  // 2. Reprocessar visitas sem prescritor com threshold mais baixo
  const semMatch = db.prepare(`
    SELECT DISTINCT nome_cliente_bruto FROM visitas WHERE prescritor_id IS NULL
  `).all() as Array<{ nome_cliente_bruto: string }>

  let linkados = 0
  for (const { nome_cliente_bruto } of semMatch) {
    const best = findBestMatch(nome_cliente_bruto, prescritores)
    if (!best || best.score < THRESHOLD) continue
    const updated = db.prepare('UPDATE visitas SET prescritor_id = ?, match_score = ?, match_confirmado = 1 WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL').run(best.id, best.score, nome_cliente_bruto)
    db.prepare('INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, ?, 1)').run(best.id, nome_cliente_bruto, 'visita')
    linkados += (updated as { changes: number }).changes
  }

  // 3. Verificar quantas ainda ficaram sem link
  const aindaSemLink = (db.prepare('SELECT COUNT(*) as cnt FROM visitas WHERE prescritor_id IS NULL').get() as { cnt: number }).cnt

  return NextResponse.json({ confirmados_pendentes: confirmados, novos_links: linkados, ainda_sem_link: aindaSemLink })
}
