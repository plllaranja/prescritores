import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calcularMetricas, calcularIndicadoresRepresentante } from '@/lib/metrics'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)

  // Períodos disponíveis
  const periodos = db.prepare(`
    SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano, mes
  `).all() as Array<{ mes: number; ano: number }>

  // Filtros
  const mesAnoParam = searchParams.get('periodos') // "1/2025,2/2025"
  const representanteIds = searchParams.get('representantes')?.split(',').map(Number).filter(Boolean)
  const territorio = searchParams.get('territorio')

  let meses: number[] = []
  let anos: number[] = []

  if (mesAnoParam) {
    for (const p of mesAnoParam.split(',')) {
      const [m, a] = p.split('/').map(Number)
      if (m && a) { meses.push(m); anos.push(a) }
    }
  } else if (periodos.length) {
    // Default: últimos 3 meses
    const ultimos = periodos.slice(-3)
    meses = ultimos.map(p => p.mes)
    anos = ultimos.map(p => p.ano)
  }

  // Filtrar por território se necessário
  let repIds = representanteIds
  if (territorio) {
    const repsTerritoryo = db.prepare('SELECT id FROM representantes WHERE territorio = ?').all(territorio) as Array<{ id: number }>
    const terIds = repsTerritoryo.map(r => r.id)
    repIds = repIds ? repIds.filter(id => terIds.includes(id)) : terIds
  }

  const metricas = calcularMetricas({ meses, anos, representante_ids: repIds?.length ? repIds : undefined })

  // KPIs gerais
  const totalVisitas = db.prepare(`
    SELECT COUNT(*) as cnt FROM visitas v
    WHERE (${meses.length > 0 ? meses.map(() => `(strftime('%m', v.data_visita) = ? AND strftime('%Y', v.data_visita) = ?)`).join(' OR ') : '1=1'})
    ${repIds?.length ? `AND v.representante_id IN (${repIds.map(() => '?').join(',')})` : ''}
  `).get(...meses.flatMap((m, i) => [String(m).padStart(2,'0'), String(anos[i])]), ...(repIds ?? [])) as { cnt: number }

  const positivacaoMedia = metricas.length > 0
    ? (metricas.filter(m => m.foi_visitado && m.valor_total > 0).length / Math.max(metricas.filter(m => m.foi_visitado).length, 1)) * 100
    : 0

  const receita_total = metricas.reduce((s, m) => s + m.valor_total, 0)
  const roi_medio = totalVisitas.cnt > 0 ? receita_total / totalVisitas.cnt : 0

  // Alertas
  const alertas = metricas
    .filter(m => m.categoria === 'risco' || m.categoria === 'reativacao')
    .map(m => ({
      prescritor_id: m.prescritor_id,
      nome: m.nome_canonico,
      categoria: m.categoria,
      tendencia: m.tendencia,
      valor_total: m.valor_total,
      foi_visitado: m.foi_visitado,
    }))

  // Evolução mensal (para gráfico)
  const evolucao = db.prepare(`
    SELECT vm.mes, vm.ano, SUM(vm.valor_total) as receita, r.nome as representante, r.id as representante_id
    FROM vendas_mensais vm
    LEFT JOIN visitas v ON v.prescritor_id = vm.prescritor_id
      AND strftime('%m', v.data_visita) = printf('%02d', vm.mes)
      AND strftime('%Y', v.data_visita) = CAST(vm.ano AS TEXT)
    LEFT JOIN representantes r ON r.id = v.representante_id
    GROUP BY vm.mes, vm.ano, r.id
    ORDER BY vm.ano, vm.mes
  `).all() as Array<{ mes: number; ano: number; receita: number; representante: string; representante_id: number }>

  // Indicadores por representante (último mês do filtro)
  const ultimoMes = meses.length > 0 ? { mes: meses[meses.length - 1], ano: anos[anos.length - 1] } : null
  const indicadoresRep = ultimoMes ? calcularIndicadoresRepresentante(ultimoMes) : []

  return NextResponse.json({
    periodos_disponiveis: periodos,
    periodo_selecionado: meses.map((m, i) => ({ mes: m, ano: anos[i] })),
    kpis: {
      total_visitas: totalVisitas.cnt,
      positivacao_media: positivacaoMedia,
      roi_medio,
      prescritores_em_risco: alertas.filter(a => a.categoria === 'risco').length,
      receita_total,
    },
    metricas,
    alertas,
    evolucao,
    indicadores_representantes: indicadoresRep,
  })
}
