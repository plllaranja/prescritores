import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calcularMetricas, calcularIndicadoresRepresentante } from '@/lib/metrics'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const session = await getSession()

    // Períodos disponíveis
    const periodos = db.prepare(
      'SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano, mes'
    ).all() as Array<{ mes: number; ano: number }>

    const periodosVisitas = db.prepare(`
      SELECT DISTINCT CAST(strftime('%m', data_visita) AS INTEGER) as mes,
                      CAST(strftime('%Y', data_visita) AS INTEGER) as ano
      FROM visitas WHERE prescritor_id IS NOT NULL ORDER BY ano, mes
    `).all() as Array<{ mes: number; ano: number }>

    const temVendas = periodos.length > 0
    const periodosEfetivos = temVendas ? periodos : periodosVisitas

    if (periodosEfetivos.length === 0) {
      return NextResponse.json({
        periodos_disponiveis: [],
        tem_vendas: false,
        periodo_selecionado: [],
        kpis: { total_visitas: 0, positivacao_media: 0, roi_medio: 0, prescritores_em_risco: 0, receita_total: 0 },
        metricas: [], alertas: [], evolucao: [], indicadores_representantes: [],
      })
    }

    // Rep filter
    let repIds: number[] | null = null
    if (session?.role === 'rep' && session.representante_id) {
      repIds = [session.representante_id]
    } else {
      const repsParam = searchParams.get('representantes')
      if (repsParam) repIds = repsParam.split(',').map(Number).filter(Boolean)
    }

    const territorio = searchParams.get('territorio')
    if (territorio) {
      const terReps = db.prepare('SELECT id FROM representantes WHERE territorio = ?').all(territorio) as Array<{ id: number }>
      const terIds = terReps.map(r => r.id)
      repIds = repIds ? repIds.filter(id => terIds.includes(id)) : terIds
    }

    // Períodos selecionados
    let meses: number[] = []
    let anos: number[] = []
    const mesAnoParam = searchParams.get('periodos')
    if (mesAnoParam) {
      for (const p of mesAnoParam.split(',')) {
        const [m, a] = p.split('/').map(Number)
        if (m && a) { meses.push(m); anos.push(a) }
      }
    } else {
      const ultimos = periodosEfetivos.slice(-3)
      meses = ultimos.map(p => p.mes)
      anos = ultimos.map(p => p.ano)
    }

    // Métricas (só quando tem vendas)
    const metricas = temVendas
      ? calcularMetricas({ meses, anos, representante_ids: repIds ?? undefined })
      : []

    // Total de visitas (query simples sem spread)
    const totalVisitas = db.prepare(
      `SELECT COUNT(*) as cnt FROM visitas${repIds?.length ? ` WHERE representante_id IN (${repIds.join(',')})` : ''}`
    ).get() as { cnt: number }

    const receita_total = metricas.reduce((s, m) => s + m.valor_total, 0)
    const visitadosComVenda = metricas.filter(m => m.foi_visitado && m.valor_total > 0).length
    const totalVisitados = metricas.filter(m => m.foi_visitado).length
    const positivacaoMedia = totalVisitados > 0 ? (visitadosComVenda / totalVisitados) * 100 : 0
    const roi_medio = totalVisitas.cnt > 0 ? receita_total / totalVisitas.cnt : 0

    const alertas = metricas
      .filter(m => m.categoria === 'risco' || m.categoria === 'reativacao')
      .map(m => ({ prescritor_id: m.prescritor_id, nome: m.nome_canonico, categoria: m.categoria, tendencia: m.tendencia, valor_total: m.valor_total, foi_visitado: m.foi_visitado }))

    const evolucao = temVendas ? db.prepare(`
      SELECT vm.mes, vm.ano, SUM(vm.valor_total) as receita, r.nome as representante
      FROM vendas_mensais vm
      LEFT JOIN visitas v ON v.prescritor_id = vm.prescritor_id
        AND strftime('%m', v.data_visita) = printf('%02d', vm.mes)
        AND strftime('%Y', v.data_visita) = CAST(vm.ano AS TEXT)
      LEFT JOIN representantes r ON r.id = v.representante_id
      GROUP BY vm.mes, vm.ano, r.id ORDER BY vm.ano, vm.mes
    `).all() : []

    const ultimoMes = meses.length > 0 ? { mes: meses[meses.length - 1], ano: anos[anos.length - 1] } : null
    const indicadoresRep = ultimoMes ? calcularIndicadoresRepresentante(ultimoMes) : []

    // Fallback sem vendas: lista prescritores por visitas
    let metricasFinais = metricas
    if (!temVendas) {
      const repFilter = repIds?.length ? `WHERE v.representante_id IN (${repIds.join(',')})` : ''
      const visitasData = db.prepare(`
        SELECT v.prescritor_id, p.nome_canonico, COUNT(*) as total_visitas,
               MAX(v.data_visita) as ultima_visita, r.nome as representante
        FROM visitas v
        JOIN prescritores p ON p.id = v.prescritor_id
        JOIN representantes r ON r.id = v.representante_id
        ${repFilter}
        GROUP BY v.prescritor_id ORDER BY total_visitas DESC
      `).all() as Array<{ prescritor_id: number; nome_canonico: string; total_visitas: number; ultima_visita: string; representante: string }>

      metricasFinais = visitasData.map(v => ({
        prescritor_id: v.prescritor_id,
        nome_canonico: v.nome_canonico,
        tipo_entidade: 'pessoa_fisica',
        valor_total: 0,
        tendencia: 'estavel',
        categoria: 'ativo_regular',
        consistencia: 'regular',
        classe_abc: 'C',
        roi_visita: null,
        foi_visitado: true,
        representantes: [v.representante],
        meses_com_venda: 0,
        prioridade_score: v.total_visitas,
      })) as unknown as typeof metricas
    }

    return NextResponse.json({
      periodos_disponiveis: periodosEfetivos,
      tem_vendas: temVendas,
      periodo_selecionado: meses.map((m, i) => ({ mes: m, ano: anos[i] })),
      kpis: { total_visitas: totalVisitas.cnt, positivacao_media: positivacaoMedia, roi_medio, prescritores_em_risco: alertas.filter(a => a.categoria === 'risco').length, receita_total },
      metricas: metricasFinais,
      alertas,
      evolucao,
      indicadores_representantes: indicadoresRep,
    })
  } catch (e) {
    console.error('[dashboard]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
