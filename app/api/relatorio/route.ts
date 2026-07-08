import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calcularMetricas } from '@/lib/metrics'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
  const session = await getSession()
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes') ?? new Date().getMonth() + 1)
  const ano = Number(searchParams.get('ano') ?? new Date().getFullYear())
  const repId = searchParams.get('representante_id')

  const db = getDb()

  // Filtra por rep se for usuário rep
  let repIds: number[] | null = null
  if (session?.role === 'rep' && session.representante_id) {
    repIds = [session.representante_id]
  } else if (repId) {
    repIds = [Number(repId)]
  }

  // Últimos 3 meses para métricas
  const periodos = db.prepare(
    'SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano DESC, mes DESC LIMIT 3'
  ).all() as Array<{ mes: number; ano: number }>

  const metricas = periodos.length > 0
    ? calcularMetricas({
        meses: periodos.map(p => p.mes),
        anos: periodos.map(p => p.ano),
        representante_ids: repIds ?? undefined,
      })
    : []

  // Visitas do mês
  let visitasSql = `
    SELECT v.prescritor_id, v.nome_cliente_bruto, v.data_visita, v.status,
           r.nome as representante, p.nome_canonico
    FROM visitas v
    LEFT JOIN representantes r ON r.id = v.representante_id
    LEFT JOIN prescritores p ON p.id = v.prescritor_id
    WHERE strftime('%m', v.data_visita) = ? AND strftime('%Y', v.data_visita) = ?
  `
  const vParams: unknown[] = [String(mes).padStart(2, '0'), String(ano)]
  if (repIds) { visitasSql += ` AND v.representante_id IN (${repIds.map(() => '?').join(',')})` ; vParams.push(...repIds) }
  visitasSql += ' ORDER BY v.data_visita DESC'

  const visitas = db.prepare(visitasSql).all(...vParams) as Array<{
    prescritor_id: number; nome_cliente_bruto: string; data_visita: string
    status: string; representante: string; nome_canonico: string
  }>

  // Cronograma do mês
  let crono = db.prepare(`
    SELECT c.data, c.status, c.categoria_prioridade,
           p.nome_canonico, p.cidade, p.bairro,
           r.nome as representante,
           (SELECT COUNT(*) FROM notas_prescritor n WHERE n.prescritor_id = p.id) as total_notas
    FROM cronograma c
    JOIN prescritores p ON p.id = c.prescritor_id
    JOIN representantes r ON r.id = c.representante_id
    WHERE strftime('%m', c.data) = ? AND strftime('%Y', c.data) = ?
    ${repIds ? `AND c.representante_id IN (${repIds.map(() => '?').join(',')})` : ''}
    ORDER BY c.data, r.nome
  `).all(String(mes).padStart(2, '0'), String(ano), ...(repIds ?? [])) as Array<{
    data: string; status: string; categoria_prioridade: string
    nome_canonico: string; cidade: string; bairro: string; representante: string; total_notas: number
  }>

  // Resumo por representante
  const porRep: Record<string, { visitas: number; realizadas: number; prescritores: Set<number>; receita: number }> = {}
  for (const v of visitas) {
    if (!porRep[v.representante]) porRep[v.representante] = { visitas: 0, realizadas: 0, prescritores: new Set(), receita: 0 }
    porRep[v.representante].visitas++
    if (v.status === 'Realizada') porRep[v.representante].realizadas++
    if (v.prescritor_id) porRep[v.representante].prescritores.add(v.prescritor_id)
  }
  for (const m of metricas) {
    // associa receita por rep via visitas
  }

  const resumoPorRep = Object.entries(porRep).map(([nome, d]) => ({
    representante: nome,
    total_visitas: d.visitas,
    realizadas: d.realizadas,
    prescritores_visitados: d.prescritores.size,
  }))

  // Resumo geral
  const totalCrono = crono.length
  const realizadasCrono = crono.filter(c => c.status === 'realizada').length

  return NextResponse.json({
    periodo: { mes, ano },
    resumo: {
      total_visitas_importadas: visitas.length,
      total_cronograma: totalCrono,
      realizadas_cronograma: realizadasCrono,
      taxa_execucao: totalCrono > 0 ? ((realizadasCrono / totalCrono) * 100).toFixed(1) : '0',
      total_prescritores: metricas.length,
      receita_total: metricas.reduce((s, m) => s + m.valor_total, 0),
    },
    por_representante: resumoPorRep,
    por_categoria: Object.fromEntries(
      ['top_roi','crescimento','reativacao','risco','ativo_medio','ativo_regular','pontual','sem_venda']
        .map(cat => [cat, metricas.filter(m => m.categoria === cat).length])
    ),
    cronograma: crono,
    prescritores: metricas.slice(0, 100).map(m => ({
      nome: m.nome_canonico,
      categoria: m.categoria,
      classe_abc: m.classe_abc,
      valor_total: m.valor_total,
      tendencia: m.tendencia,
      roi_visita: m.roi_visita,
      foi_visitado: m.foi_visitado,
    })),
  })
  } catch (e) {
    console.error('[relatorio]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
