import { NextRequest, NextResponse } from 'next/server'
import { getDb, getConfig } from '@/lib/db'
import { calcularMetricas } from '@/lib/metrics'

const DIA_SEMANA_TEMAS: Record<number, string[]> = {
  1: ['top_roi'],          // Segunda
  2: ['reativacao','risco'], // Terça
  3: ['crescimento','ativo_medio'], // Quarta
  4: ['ativo_regular'],    // Quinta
  5: ['pontual','sem_venda'], // Sexta
}

function getTemasConfig(): Record<number, string[]> {
  const temas = { ...DIA_SEMANA_TEMAS }
  try {
    const s = getConfig('tema_segunda'); if (s) temas[1] = s.split(',')
    const t = getConfig('tema_terca'); if (t) temas[2] = t.split(',')
    const q = getConfig('tema_quarta'); if (q) temas[3] = q.split(',')
    const qi = getConfig('tema_quinta'); if (qi) temas[4] = qi.split(',')
    const sx = getConfig('tema_sexta'); if (sx) temas[5] = sx.split(',')
  } catch {}
  return temas
}

function getDiasUteisDoMes(mes: number, ano: number, feriados: string[] = []): Date[] {
  const dias: Date[] = []
  const date = new Date(ano, mes - 1, 1)
  while (date.getMonth() === mes - 1) {
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) {
      const str = date.toISOString().slice(0, 10)
      if (!feriados.includes(str)) dias.push(new Date(date))
    }
    date.setDate(date.getDate() + 1)
  }
  return dias
}

export async function POST(req: NextRequest) {
  const { mes, ano, feriados = [] } = await req.json()
  const db = getDb()

  // Remover cronograma existente do mês
  db.prepare(`DELETE FROM cronograma WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?`)
    .run(String(mes).padStart(2,'0'), String(ano))

  const reps = db.prepare('SELECT id, nome, territorio, visitas_por_dia FROM representantes WHERE ativo = 1').all() as Array<{ id: number; nome: string; territorio: string; visitas_por_dia: number }>
  const temas = getTemasConfig()
  const diasUteis = getDiasUteisDoMes(mes, ano, feriados)

  // Calcular métricas para priorização (últimos 3 meses)
  const periodos = db.prepare('SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano DESC, mes DESC LIMIT 3').all() as Array<{ mes: number; ano: number }>
  const metricas = periodos.length > 0
    ? calcularMetricas({ meses: periodos.map(p => p.mes), anos: periodos.map(p => p.ano) })
    : []

  const insertCronograma = db.prepare(`
    INSERT INTO cronograma (representante_id, data, prescritor_id, categoria_prioridade, status)
    VALUES (?, ?, ?, ?, 'pendente')
  `)

  const txn = db.transaction(() => {
    for (const rep of reps) {
      // Carteira deste representante
      const carteira = db.prepare(`
        SELECT DISTINCT prescritor_id FROM visitas WHERE representante_id = ? AND prescritor_id IS NOT NULL
      `).all(rep.id) as Array<{ prescritor_id: number }>

      const carteiraIds = new Set(carteira.map(c => c.prescritor_id))
      const metricasRep = metricas
        .filter(m => carteiraIds.has(m.prescritor_id))
        .sort((a, b) => b.prioridade_score - a.prioridade_score)

      // Distribuir por dia
      const visitasPorDia = rep.visitas_por_dia ?? 6
      const pool: typeof metricasRep = []

      for (const dia of diasUteis) {
        const dow = dia.getDay() // 1=seg, 5=sex
        const temasDia = temas[dow] ?? ['ativo_regular']

        // Priorizar por tema do dia
        const porTema = metricasRep.filter(m => temasDia.includes(m.categoria))
        const outros = metricasRep.filter(m => !temasDia.includes(m.categoria))
        const ordenados = [...porTema, ...outros]

        const dataStr = dia.toISOString().slice(0, 10)
        let count = 0

        for (const m of ordenados) {
          if (count >= visitasPorDia) break
          insertCronograma.run(rep.id, dataStr, m.prescritor_id, m.categoria)
          count++
        }

        // Se não preencheu, usar pool de qualquer categoria
        if (count < visitasPorDia && pool.length > 0) {
          for (const m of pool) {
            if (count >= visitasPorDia) break
            insertCronograma.run(rep.id, dataStr, m.prescritor_id, m.categoria)
            count++
          }
        }
      }
    }
  })
  txn()

  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM cronograma
    WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?
  `).get(String(mes).padStart(2,'0'), String(ano)) as { cnt: number }

  return NextResponse.json({ ok: true, visitas_geradas: total.cnt })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')
  const repId = searchParams.get('representante_id')

  const db = getDb()
  let sql = `
    SELECT c.id, c.data, c.status, c.categoria_prioridade, c.observacoes,
           p.nome_canonico as prescritor_nome, p.tipo_entidade,
           r.nome as representante_nome, r.territorio
    FROM cronograma c
    JOIN prescritores p ON p.id = c.prescritor_id
    JOIN representantes r ON r.id = c.representante_id
    WHERE 1=1
  `
  const params: unknown[] = []
  if (mes && ano) {
    sql += ` AND strftime('%m', c.data) = ? AND strftime('%Y', c.data) = ?`
    params.push(mes.padStart(2,'0'), ano)
  }
  if (repId) { sql += ` AND c.representante_id = ?`; params.push(repId) }
  sql += ` ORDER BY c.data, r.nome, c.categoria_prioridade`

  const visitas = db.prepare(sql).all(...params)
  return NextResponse.json(visitas)
}

export async function PATCH(req: NextRequest) {
  const { id, status, observacoes } = await req.json()
  getDb().prepare('UPDATE cronograma SET status = ?, observacoes = ? WHERE id = ?').run(status, observacoes ?? null, id)
  return NextResponse.json({ ok: true })
}
