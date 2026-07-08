import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prescitorId = searchParams.get('prescritor_id')
  if (!prescitorId) return NextResponse.json([])

  const db = getDb()
  const notas = db.prepare(`
    SELECT n.id, n.data, n.conteudo, n.criado_em,
           r.nome as representante_nome,
           c.categoria_prioridade
    FROM notas_prescritor n
    LEFT JOIN representantes r ON r.id = n.representante_id
    LEFT JOIN cronograma c ON c.id = n.visita_id
    WHERE n.prescritor_id = ?
    ORDER BY n.data DESC, n.criado_em DESC
    LIMIT 50
  `).all(prescitorId)

  return NextResponse.json(notas)
}

export async function POST(req: NextRequest) {
  const { prescritor_id, visita_id, representante_id, conteudo, data } = await req.json()
  if (!prescritor_id || !conteudo?.trim()) {
    return NextResponse.json({ error: 'prescritor_id e conteudo obrigatórios' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO notas_prescritor (prescritor_id, visita_id, representante_id, data, conteudo)
    VALUES (?, ?, ?, ?, ?)
  `).run(prescritor_id, visita_id ?? null, representante_id ?? null, data ?? new Date().toISOString().slice(0, 10), conteudo.trim())

  // Marcar visita como realizada se foi vinculada
  if (visita_id) {
    db.prepare(`UPDATE cronograma SET status = 'realizada' WHERE id = ?`).run(visita_id)
  }

  return NextResponse.json({ ok: true, id: result.lastInsertRowid })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  getDb().prepare('DELETE FROM notas_prescritor WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
