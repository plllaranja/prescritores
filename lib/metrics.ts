import { getDb, getConfig } from './db'

export type Tendencia = 'crescimento' | 'queda_forte' | 'queda_total' | 'estavel' | 'nunca_comprou'
export type Consistencia = 'consistente' | 'parcial' | 'pontual' | 'sem_venda'
export type Categoria = 'top_roi' | 'crescimento' | 'reativacao' | 'risco' | 'ativo_medio' | 'ativo_regular' | 'pontual' | 'sem_venda'
export type ClasseABC = 'A' | 'B' | 'C'

export interface PrescritoreMetrica {
  prescritor_id: number
  nome_canonico: string
  tipo_entidade: string
  valor_total: number
  qtd_vendas: number
  meses_com_venda: number
  roi_visita: number | null
  tendencia: Tendencia
  consistencia: Consistencia
  categoria: Categoria
  classe_abc: ClasseABC
  foi_visitado: boolean
  representantes: string[]
  prioridade_score: number
  ultimo_mes_venda: number | null
  ultimo_ano_venda: number | null
}

interface VendaRow { mes: number; ano: number; valor_total: number; prescritor_id: number }
interface VisitaRow { prescritor_id: number; representante_nome: string; data_visita: string }

function calcTendencia(vendas: VendaRow[], meses: Array<{mes: number; ano: number}>): Tendencia {
  if (meses.length === 0) return 'nunca_comprou'
  const getVal = (mes: number, ano: number) =>
    vendas.find(v => v.mes === mes && v.ano === ano)?.valor_total ?? 0

  const primeiro = getVal(meses[0].mes, meses[0].ano)
  const ultimo = getVal(meses[meses.length - 1].mes, meses[meses.length - 1].ano)

  if (vendas.every(v => v.valor_total === 0)) return 'nunca_comprou'
  if (primeiro > 0 && ultimo === 0) {
    const recentes = meses.slice(-2).map(m => getVal(m.mes, m.ano))
    if (recentes.every(v => v === 0)) return 'queda_total'
  }
  if (primeiro > 0 && ultimo < primeiro * 0.5) return 'queda_forte'
  if (ultimo > primeiro * 1.1 && ultimo > 0) return 'crescimento'
  return 'estavel'
}

function calcConsistencia(vendas: VendaRow[], ultimos3Meses: Array<{mes: number; ano: number}>): Consistencia {
  const comVenda = ultimos3Meses.filter(m =>
    vendas.some(v => v.mes === m.mes && v.ano === m.ano && v.valor_total > 0)
  ).length
  if (comVenda === 3) return 'consistente'
  if (comVenda === 2) return 'parcial'
  if (comVenda === 1) return 'pontual'
  return 'sem_venda'
}

function calcCategoria(
  valorTotal: number, mesesComVenda: number, tendencia: Tendencia,
  foiVisitado: boolean, limiteTopRoi: number, limiteAtivMedio: number, mesesMinTopRoi: number
): Categoria {
  if (valorTotal >= limiteTopRoi && mesesComVenda >= mesesMinTopRoi) return 'top_roi'
  if (tendencia === 'crescimento') return 'crescimento'
  if ((tendencia === 'queda_forte' || tendencia === 'queda_total') && foiVisitado) return 'reativacao'
  if (tendencia === 'queda_forte' && !foiVisitado) return 'risco'
  if (valorTotal >= limiteAtivMedio) return 'ativo_medio'
  if (valorTotal > 0 && mesesComVenda >= 2) return 'ativo_regular'
  if (valorTotal > 0) return 'pontual'
  return 'sem_venda'
}

function calcPrioridade(valorTotal: number, mesesComVenda: number, tendencia: Tendencia, foiVisitado: boolean): number {
  let score = Math.min(valorTotal / 1000, 50)
  score += mesesComVenda * 10
  if (tendencia === 'crescimento') score += 20
  if (tendencia === 'queda_forte') score += 15
  if (tendencia === 'queda_total') score += 5
  if (tendencia === 'nunca_comprou') score -= 20
  if (foiVisitado) score += 5
  return score
}

function calcClasseABC(prescritores: Array<{ valor_total: number }>, idx: number, totalReceita: number): ClasseABC {
  let acumulado = 0
  for (let i = 0; i <= idx; i++) acumulado += prescritores[i].valor_total
  const pct = totalReceita > 0 ? acumulado / totalReceita : 0
  if (pct <= 0.8) return 'A'
  if (pct <= 0.95) return 'B'
  return 'C'
}

export function calcularMetricas(params: {
  meses?: number[]
  anos?: number[]
  representante_ids?: number[]
  territorio?: string
}): PrescritoreMetrica[] {
  const db = getDb()
  const limiteTopRoi = parseFloat(getConfig('valor_top_roi') ?? '15000')
  const limiteAtivMedio = parseFloat(getConfig('valor_ativo_medio') ?? '5000')
  const mesesMinTopRoi = parseInt(getConfig('meses_top_roi') ?? '2')

  let whereVendas = '1=1'
  let whereVisitas = '1=1'
  const vendaParams: unknown[] = []
  const visitaParams: unknown[] = []

  if (params.meses?.length && params.anos?.length) {
    // Sem alias — usado em queries diretas na tabela
    const conds = params.meses.map(() => `(mes = ? AND ano = ?)`).join(' OR ')
    whereVendas = `(${conds})`
    for (let i = 0; i < params.meses.length; i++) { vendaParams.push(params.meses[i]); vendaParams.push(params.anos[i]) }
    const conds2 = params.meses.map(() => `(strftime('%m', v.data_visita) = ? AND strftime('%Y', v.data_visita) = ?)`).join(' OR ')
    whereVisitas = `(${conds2})`
    for (let i = 0; i < params.meses.length; i++) { visitaParams.push(String(params.meses[i]).padStart(2,'0')); visitaParams.push(String(params.anos[i])) }
  }

  if (params.representante_ids?.length) {
    const placeholders = params.representante_ids.map(() => '?').join(',')
    whereVisitas += ` AND v.representante_id IN (${placeholders})`
    visitaParams.push(...params.representante_ids)
  }

  // Vendas no período
  const vendas = db.prepare(`
    SELECT prescritor_id, mes, ano, valor_total
    FROM vendas_mensais
    WHERE ${whereVendas}
  `).all(...vendaParams) as VendaRow[]

  // Todos os meses no período
  const todosMeses = db.prepare(`
    SELECT DISTINCT mes, ano FROM vendas_mensais WHERE ${whereVendas} ORDER BY ano, mes
  `).all(...vendaParams) as Array<{mes: number; ano: number}>

  const ultimos3 = todosMeses.slice(-3)

  // Visitas — todas, sem filtro de período (foi_visitado é independente do mês de venda)
  let visitasSql = `
    SELECT v.prescritor_id, r.nome as representante_nome, v.data_visita
    FROM visitas v
    LEFT JOIN representantes r ON r.id = v.representante_id
    WHERE v.prescritor_id IS NOT NULL
  `
  const visitasAllParams: unknown[] = []
  if (params.representante_ids?.length) {
    visitasSql += ` AND v.representante_id IN (${params.representante_ids.map(() => '?').join(',')})`
    visitasAllParams.push(...params.representante_ids)
  }
  const visitas = db.prepare(visitasSql).all(...visitasAllParams) as VisitaRow[]

  // Todos os prescritores com ao menos uma entrada (venda ou visita)
  const prescIds = new Set<number>([
    ...vendas.map(v => v.prescritor_id),
    ...visitas.map(v => v.prescritor_id).filter(Boolean),
  ])

  const prescInfo = db.prepare(`
    SELECT id, nome_canonico, tipo_entidade FROM prescritores WHERE id IN (${[...prescIds].map(() => '?').join(',') || 'NULL'})
  `).all(...prescIds) as Array<{ id: number; nome_canonico: string; tipo_entidade: string }>

  const infoMap = new Map(prescInfo.map(p => [p.id, p]))

  const metricas: PrescritoreMetrica[] = []

  for (const pid of prescIds) {
    const info = infoMap.get(pid)
    if (!info) continue

    const vendasPresc = vendas.filter(v => v.prescritor_id === pid)
    const visitasPresc = visitas.filter(v => v.prescritor_id === pid)

    const valorTotal = vendasPresc.reduce((s, v) => s + v.valor_total, 0)
    const qtdVendas = vendasPresc.reduce((s, v) => s + 1, 0)
    const mesesComVenda = vendasPresc.filter(v => v.valor_total > 0).length
    const foiVisitado = visitasPresc.length > 0
    const totalVisitas = visitasPresc.length
    const roi_visita = totalVisitas > 0 ? valorTotal / totalVisitas : null

    const tendencia = calcTendencia(vendasPresc, todosMeses)
    const consistencia = calcConsistencia(vendasPresc, ultimos3)
    const categoria = calcCategoria(valorTotal, mesesComVenda, tendencia, foiVisitado, limiteTopRoi, limiteAtivMedio, mesesMinTopRoi)
    const prioridade_score = calcPrioridade(valorTotal, mesesComVenda, tendencia, foiVisitado)

    const reps = [...new Set(visitasPresc.map(v => v.representante_nome).filter(Boolean))]

    const ultimaVenda = vendasPresc.filter(v => v.valor_total > 0).sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0]

    metricas.push({
      prescritor_id: pid,
      nome_canonico: info.nome_canonico,
      tipo_entidade: info.tipo_entidade,
      valor_total: valorTotal,
      qtd_vendas: qtdVendas,
      meses_com_venda: mesesComVenda,
      roi_visita,
      tendencia,
      consistencia,
      categoria,
      classe_abc: 'A', // calculado após sort
      foi_visitado: foiVisitado,
      representantes: reps,
      prioridade_score,
      ultimo_mes_venda: ultimaVenda?.mes ?? null,
      ultimo_ano_venda: ultimaVenda?.ano ?? null,
    })
  }

  // Curva ABC
  metricas.sort((a, b) => b.valor_total - a.valor_total)
  const totalReceita = metricas.reduce((s, m) => s + m.valor_total, 0)
  metricas.forEach((m, i) => { m.classe_abc = calcClasseABC(metricas, i, totalReceita) })

  return metricas
}

export interface RepresentanteIndicadores {
  representante_id: number
  nome: string
  territorio: string | null
  visitas_realizadas: number
  cobertura_carteira_pct: number | null
  positivacao_pct: number | null
  receita_por_visita: number | null
  prescritores_em_risco: number
  prescritores_novos_ativados: number
}

export function calcularIndicadoresRepresentante(params: {
  mes: number; ano: number
}): RepresentanteIndicadores[] {
  const db = getDb()
  const diasAlerta = parseInt(getConfig('dias_sem_visita_alerta') ?? '60')

  const reps = db.prepare('SELECT id, nome, territorio FROM representantes WHERE ativo = 1').all() as Array<{ id: number; nome: string; territorio: string }>

  const result: RepresentanteIndicadores[] = []

  for (const rep of reps) {
    // Visitas no mês
    const visitas = db.prepare(`
      SELECT v.prescritor_id, v.data_visita
      FROM visitas v
      WHERE v.representante_id = ?
        AND strftime('%m', v.data_visita) = ?
        AND strftime('%Y', v.data_visita) = ?
    `).all(rep.id, String(params.mes).padStart(2,'0'), String(params.ano)) as Array<{ prescritor_id: number; data_visita: string }>

    const visitasRealizadas = visitas.length

    // Carteira histórica (todos prescritores já visitados)
    const carteira = db.prepare(`
      SELECT DISTINCT prescritor_id FROM visitas WHERE representante_id = ? AND prescritor_id IS NOT NULL
    `).all(rep.id) as Array<{ prescritor_id: number }>

    const carteiraTamanho = carteira.length
    const prescVisitadosMes = new Set(visitas.map(v => v.prescritor_id).filter(Boolean))
    const cobertura = carteiraTamanho > 0
      ? (prescVisitadosMes.size / carteiraTamanho) * 100
      : null

    // Positivação: visitados que tiveram venda > 0 no mês
    let comVenda = 0
    for (const pid of prescVisitadosMes) {
      const venda = db.prepare(`
        SELECT valor_total FROM vendas_mensais WHERE prescritor_id = ? AND mes = ? AND ano = ?
      `).get(pid, params.mes, params.ano) as { valor_total: number } | undefined
      if (venda && venda.valor_total > 0) comVenda++
    }
    const positivacao = prescVisitadosMes.size > 0 ? (comVenda / prescVisitadosMes.size) * 100 : null

    // Receita / visita
    let receitaTotal = 0
    for (const pid of prescVisitadosMes) {
      const venda = db.prepare(`SELECT valor_total FROM vendas_mensais WHERE prescritor_id = ? AND mes = ? AND ano = ?`).get(pid, params.mes, params.ano) as { valor_total: number } | undefined
      if (venda) receitaTotal += venda.valor_total
    }
    const receitaPorVisita = visitasRealizadas > 0 ? receitaTotal / visitasRealizadas : null

    // Prescritores em risco (carteira sem visita há X dias)
    const dataRef = `${params.ano}-${String(params.mes).padStart(2,'0')}-28`
    const emRisco = db.prepare(`
      SELECT COUNT(DISTINCT v.prescritor_id) as cnt FROM visitas v
      WHERE v.representante_id = ? AND v.prescritor_id IS NOT NULL
        AND julianday(?) - julianday((
          SELECT MAX(v2.data_visita) FROM visitas v2 WHERE v2.prescritor_id = v.prescritor_id AND v2.representante_id = ?
        )) > ?
    `).get(rep.id, dataRef, rep.id, diasAlerta) as { cnt: number }

    // Prescritores novos ativados
    const novosAtivados = db.prepare(`
      SELECT COUNT(DISTINCT vm.prescritor_id) as cnt
      FROM vendas_mensais vm
      WHERE vm.mes = ? AND vm.ano = ? AND vm.valor_total > 0
        AND vm.prescritor_id IN (SELECT DISTINCT prescritor_id FROM visitas WHERE representante_id = ?)
        AND NOT EXISTS (
          SELECT 1 FROM vendas_mensais vm2
          WHERE vm2.prescritor_id = vm.prescritor_id
            AND vm2.valor_total > 0
            AND (vm2.ano < ? OR (vm2.ano = ? AND vm2.mes < ?))
        )
    `).get(params.mes, params.ano, rep.id, params.ano, params.ano, params.mes) as { cnt: number }

    result.push({
      representante_id: rep.id,
      nome: rep.nome,
      territorio: rep.territorio,
      visitas_realizadas: visitasRealizadas,
      cobertura_carteira_pct: cobertura,
      positivacao_pct: positivacao,
      receita_por_visita: receitaPorVisita,
      prescritores_em_risco: emRisco.cnt,
      prescritores_novos_ativados: novosAtivados.cnt,
    })
  }
  return result
}
