import { NextRequest, NextResponse } from 'next/server'
import { getDb, getConfig } from '@/lib/db'
import { calcularMetricas } from '@/lib/metrics'

const DIA_SEMANA_TEMAS: Record<number, string[]> = {
  1: ['top_roi'],
  2: ['reativacao', 'risco'],
  3: ['crescimento', 'ativo_medio'],
  4: ['ativo_regular'],
  5: ['pontual', 'sem_venda'],
}

function getTemasConfig(): Record<number, string[]> {
  const temas = { ...DIA_SEMANA_TEMAS }
  try {
    const s = getConfig('tema_segunda'); if (s) temas[1] = s.split(',')
    const t = getConfig('tema_terca');   if (t) temas[2] = t.split(',')
    const q = getConfig('tema_quarta');  if (q) temas[3] = q.split(',')
    const qi = getConfig('tema_quinta'); if (qi) temas[4] = qi.split(',')
    const sx = getConfig('tema_sexta');  if (sx) temas[5] = sx.split(',')
  } catch {}
  return temas
}

function getDiasDoMes(mes: number, ano: number, diasVisita: number[], feriados: string[]): Date[] {
  const dias: Date[] = []
  const date = new Date(ano, mes - 1, 1)
  while (date.getMonth() === mes - 1) {
    const dow = date.getDay()
    if (diasVisita.includes(dow)) {
      const str = date.toISOString().slice(0, 10)
      if (!feriados.includes(str)) dias.push(new Date(date))
    }
    date.setDate(date.getDate() + 1)
  }
  return dias
}

// Extrai prefixo da rua para proximidade (primeiras 2 palavras significativas)
function prefixoRua(logradouro: string | null): string {
  if (!logradouro) return ''
  return logradouro
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => !['rua','av','avenida','r','rod','rodovia','al','alameda','pc','praca','trav','travessa'].includes(w))
    .slice(0, 2)
    .join(' ')
}

// Extrai prefixo do bairro para proximidade (primeira palavra)
function prefixoBairro(bairro: string | null): string {
  if (!bairro) return ''
  return bairro.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)[0]
}

interface Loc {
  cidade: string | null
  bairro: string | null
  logradouro: string | null
}

// Calcula score de proximidade geográfica entre dois prescritores (menor = mais próximo)
// Cidade é SEMPRE parte da chave — "Rua XV" em Curitiba ≠ "Rua XV" em Ponta Grossa
function distGeo(a: Loc, b: Loc): number {
  if (!a || !b) return 100

  const cidadeA = (a.cidade ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const cidadeB = (b.cidade ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const bairroA = (a.bairro ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const bairroB = (b.bairro ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const ruaA    = (a.logradouro ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const ruaB    = (b.logradouro ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  // Cidades diferentes → impossível agrupar, independente de rua/bairro
  const mesmasCidades = cidadeA && cidadeB && cidadeA === cidadeB
  if (cidadeA && cidadeB && !mesmasCidades) return 100

  // A partir daqui, ou mesma cidade ou uma delas sem cidade informada
  const mesmoBairro   = bairroA && bairroB && bairroA === bairroB
  const bairroProximo = bairroA && bairroB && prefixoBairro(bairroA) === prefixoBairro(bairroB) && !!prefixoBairro(bairroA)
  const mesmaRua      = ruaA && ruaB && ruaA === ruaB
  const ruaProxima    = ruaA && ruaB && prefixoRua(ruaA) === prefixoRua(ruaB) && !!prefixoRua(ruaA)

  // Mesma rua só conta se cidade (e de preferência bairro) também bater
  if (mesmaRua && mesmasCidades && mesmoBairro)  return 0  // Mesma rua, mesmo bairro, mesma cidade ✓
  if (mesmaRua && mesmasCidades)                 return 1  // Mesma rua, mesma cidade (bairro não informado)
  if (ruaProxima && mesmasCidades && mesmoBairro) return 2  // Rua próxima, mesmo bairro, mesma cidade
  if (ruaProxima && mesmasCidades)               return 3  // Rua próxima, mesma cidade
  if (mesmoBairro && mesmasCidades)              return 4  // Mesmo bairro, mesma cidade
  if (bairroProximo && mesmasCidades)            return 5  // Bairro próximo, mesma cidade
  if (mesmasCidades)                             return 6  // Mesma cidade, sem mais info
  return 10                                                // Sem cidade ou cidades distintas
}

// Dado um "âncora" (primeiro prescritor do dia), ordena o restante por proximidade
function ordenarPorProximidade<T extends { prescritor_id: number }>(
  ancora: Loc,
  candidatos: T[],
  locMap: Map<number, Loc>
): T[] {
  return [...candidatos].sort((a, b) => {
    const la = locMap.get(a.prescritor_id)
    const lb = locMap.get(b.prescritor_id)
    if (!la && !lb) return 0
    if (!la) return 1
    if (!lb) return -1
    return distGeo(ancora, la) - distGeo(ancora, lb)
  })
}

// Gera o cronograma de um único rep com seu pool de prescritores
function gerarParaRep(
  db: ReturnType<typeof getDb>,
  rep: { id: number; nome: string; visitas_por_dia: number },
  pool: Array<{ prescritor_id: number; categoria: string; prioridade_score: number }>,
  locMap: Map<number, Loc>,
  diasDoMes: Date[],
  temas: Record<number, string[]>,
  visitasPorDiaOverride: number | undefined,
  insertCronograma: ReturnType<typeof db.prepare>,
) {
  const visitasPorDia = visitasPorDiaOverride ?? rep.visitas_por_dia ?? 6
  const agendados = new Set<number>()

  for (const dia of diasDoMes) {
    const dow = dia.getDay()
    const temasDia = temas[dow] ?? ['ativo_regular']
    const dataStr = dia.toISOString().slice(0, 10)

    const porTema = pool.filter(m => temasDia.includes(m.categoria) && !agendados.has(m.prescritor_id))
    const outros  = pool.filter(m => !temasDia.includes(m.categoria) && !agendados.has(m.prescritor_id))
    const candidatos = [...porTema, ...outros]
    if (candidatos.length === 0) continue

    // Âncora geográfica
    let ancora: Loc | null = null
    let melhorScore = -1
    for (const m of candidatos.slice(0, Math.min(candidatos.length, 30))) {
      const loc = locMap.get(m.prescritor_id)
      if (!loc || (!loc.bairro && !loc.logradouro)) continue
      const viz = candidatos.filter(c => { const l = locMap.get(c.prescritor_id); return l && distGeo(loc, l) <= 2 }).length
      if (viz > melhorScore) { melhorScore = viz; ancora = loc }
    }
    const ancoraFinal: Loc = ancora ?? (locMap.get(candidatos[0].prescritor_id) ?? { cidade: null, bairro: null, logradouro: null })
    const ordenados = ordenarPorProximidade(ancoraFinal, candidatos, locMap)

    let count = 0
    for (const m of ordenados) {
      if (count >= visitasPorDia) break
      insertCronograma.run(rep.id, dataStr, m.prescritor_id, m.categoria)
      agendados.add(m.prescritor_id)
      count++
    }
  }
  return agendados.size
}

export async function POST(req: NextRequest) {
  const {
    mes, ano,
    feriados = [],
    dias_visita = [1, 2, 3, 4, 5],
    visitas_por_dia_override,
    // Configuração por rep: [{ rep_id, visitas_por_dia }]
    config_reps = [] as Array<{ rep_id: number; visitas_por_dia?: number }>,
    // IDs dos reps que devem receber cronograma. Se vazio, usa todos ativos
    representante_ids = [] as number[],
    // modo: 'carteira' (histórico do rep) | 'distribuir' (divide pool entre reps selecionados)
    modo = 'distribuir',
  } = await req.json()

  const db = getDb()

  db.prepare(`DELETE FROM cronograma WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?`)
    .run(String(mes).padStart(2, '0'), String(ano))

  // Reps participantes
  let reps = db.prepare(
    'SELECT id, nome, territorio, visitas_por_dia FROM representantes WHERE ativo = 1'
  ).all() as Array<{ id: number; nome: string; territorio: string; visitas_por_dia: number }>

  if (representante_ids.length > 0) {
    reps = reps.filter(r => representante_ids.includes(r.id))
  }
  if (reps.length === 0) return NextResponse.json({ ok: true, visitas_geradas: 0 })

  const temas = getTemasConfig()
  const diasDoMes = getDiasDoMes(mes, ano, dias_visita, feriados)

  const periodos = db.prepare(
    'SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano DESC, mes DESC LIMIT 3'
  ).all() as Array<{ mes: number; ano: number }>

  const metricas = periodos.length > 0
    ? calcularMetricas({ meses: periodos.map(p => p.mes), anos: periodos.map(p => p.ano) })
    : []

  // Mapa de localização de TODOS os prescritores
  const todosPresc = db.prepare('SELECT id, cidade, bairro, logradouro FROM prescritores').all() as Array<{ id: number } & Loc>
  const locMap = new Map<number, Loc>()
  for (const p of todosPresc) locMap.set(p.id, { cidade: p.cidade, bairro: p.bairro, logradouro: p.logradouro })

  const insertCronograma = db.prepare(`
    INSERT INTO cronograma (representante_id, data, prescritor_id, categoria_prioridade, status)
    VALUES (?, ?, ?, ?, 'pendente')
  `)

  // Helper: resolve visitas_por_dia para um rep
  const vpd = (repId: number) => {
    const cfg = config_reps.find((c: { rep_id: number }) => c.rep_id === repId)
    return visitas_por_dia_override ?? cfg?.visitas_por_dia ?? reps.find(r => r.id === repId)?.visitas_por_dia ?? 6
  }

  const txn = db.transaction(() => {
    if (modo === 'carteira') {
      // Modo clássico: cada rep recebe os prescritores da sua carteira histórica
      for (const rep of reps) {
        const carteira = db.prepare(
          'SELECT DISTINCT prescritor_id FROM visitas WHERE representante_id = ? AND prescritor_id IS NOT NULL'
        ).all(rep.id) as Array<{ prescritor_id: number }>

        let pool = metricas
          .filter(m => carteira.some(c => c.prescritor_id === m.prescritor_id))
          .sort((a, b) => b.prioridade_score - a.prioridade_score)
          .map(m => ({ prescritor_id: m.prescritor_id, categoria: m.categoria, prioridade_score: m.prioridade_score }))

        if (pool.length === 0 && carteira.length > 0) {
          pool = carteira.map(c => ({ prescritor_id: c.prescritor_id, categoria: 'ativo_regular', prioridade_score: 0 }))
        }

        gerarParaRep(db, rep, pool, locMap, diasDoMes, temas, vpd(rep.id), insertCronograma)
      }
    } else {
      // Modo distribuir: divide o pool global entre os reps selecionados por cidade/prioridade
      // 1. Pool global de prescritores ordenado por prioridade
      const poolGlobal = metricas.length > 0
        ? metricas.sort((a, b) => b.prioridade_score - a.prioridade_score)
            .map(m => ({ prescritor_id: m.prescritor_id, categoria: m.categoria, prioridade_score: m.prioridade_score }))
        : (db.prepare('SELECT id as prescritor_id FROM prescritores').all() as Array<{ prescritor_id: number }>)
            .map(p => ({ prescritor_id: p.prescritor_id, categoria: 'ativo_regular', prioridade_score: 0 }))

      // 2. Se reps têm território definido, agrupar prescritores por cidade → rep
      const repComTerritorio = reps.filter(r => r.territorio)
      const repSemTerritorio = reps.filter(r => !r.territorio)

      const poolPorRep = new Map<number, typeof poolGlobal>()
      reps.forEach(r => poolPorRep.set(r.id, []))

      const jaAtribuidos = new Set<number>()

      // Prescritores por cidade → rep que tem o território correspondente
      if (repComTerritorio.length > 0) {
        for (const item of poolGlobal) {
          const loc = locMap.get(item.prescritor_id)
          const cidade = (loc?.cidade ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          const repMatch = repComTerritorio.find(r =>
            r.territorio && cidade.includes(r.territorio.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
          )
          if (repMatch) {
            poolPorRep.get(repMatch.id)!.push(item)
            jaAtribuidos.add(item.prescritor_id)
          }
        }
      }

      // Restantes: distribuir round-robin por prioridade entre os reps sem território (ou todos se nenhum tem território)
      const repsParaDistribuir = repSemTerritorio.length > 0 ? repSemTerritorio : reps
      const restantes = poolGlobal.filter(p => !jaAtribuidos.has(p.prescritor_id))

      // Round-robin agrupado por geo: dividir em grupos do tamanho do total de dias × vpd para cada rep
      const capacidadePorRep = repsParaDistribuir.map(r => ({
        rep: r,
        capacidade: diasDoMes.length * vpd(r.id),
      }))
      const totalCapacidade = capacidadePorRep.reduce((s, c) => s + c.capacidade, 0)

      let idx = 0
      for (const { rep, capacidade } of capacidadePorRep) {
        const quota = Math.ceil((capacidade / totalCapacidade) * restantes.length)
        poolPorRep.get(rep.id)!.push(...restantes.slice(idx, idx + quota))
        idx += quota
      }

      // Gerar para cada rep com seu pool
      for (const rep of reps) {
        const pool = poolPorRep.get(rep.id) ?? []
        gerarParaRep(db, rep, pool, locMap, diasDoMes, temas, vpd(rep.id), insertCronograma)
      }
    }
  })

  txn()

  const total = db.prepare(`
    SELECT r.nome, COUNT(*) as cnt FROM cronograma c
    JOIN representantes r ON r.id = c.representante_id
    WHERE strftime('%m', c.data) = ? AND strftime('%Y', c.data) = ?
    GROUP BY r.id
  `).all(String(mes).padStart(2, '0'), String(ano)) as Array<{ nome: string; cnt: number }>

  const totalGeral = total.reduce((s, r) => s + r.cnt, 0)
  return NextResponse.json({ ok: true, visitas_geradas: totalGeral, por_rep: total })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')
  const repId = searchParams.get('representante_id')

  const db = getDb()
  let sql = `
    SELECT c.id, c.data, c.status, c.categoria_prioridade, c.observacoes,
           p.id as prescritor_id, p.nome_canonico as prescritor_nome, p.tipo_entidade, p.cidade, p.bairro, p.logradouro,
           r.id as representante_id, r.nome as representante_nome, r.territorio,
           (SELECT COUNT(*) FROM notas_prescritor n WHERE n.prescritor_id = p.id) as total_notas
    FROM cronograma c
    JOIN prescritores p ON p.id = c.prescritor_id
    JOIN representantes r ON r.id = c.representante_id
    WHERE 1=1
  `
  const params: unknown[] = []
  if (mes && ano) {
    sql += ` AND strftime('%m', c.data) = ? AND strftime('%Y', c.data) = ?`
    params.push(mes.padStart(2, '0'), ano)
  }
  if (repId) { sql += ` AND c.representante_id = ?`; params.push(repId) }
  sql += ` ORDER BY c.data, r.nome, c.categoria_prioridade`

  return NextResponse.json(db.prepare(sql).all(...params))
}

export async function PATCH(req: NextRequest) {
  const { id, status, observacoes } = await req.json()
  getDb().prepare('UPDATE cronograma SET status = ?, observacoes = ? WHERE id = ?')
    .run(status, observacoes ?? null, id)
  return NextResponse.json({ ok: true })
}
