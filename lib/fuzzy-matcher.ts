// @ts-expect-error fuzzball has no types
import fuzz from 'fuzzball'
import { getDb, getConfig } from './db'

export interface MatchResult {
  nome_visita: string
  nome_candidato: string
  prescritor_id: number
  score: number
  tipo: 'automatico' | 'revisao' | 'nao_associado'
}

function normalizeForMatch(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bDR\.?\s*/g, '')
    .replace(/\bDRA\.?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getThresholds() {
  const auto = parseInt(getConfig('fuzzy_score_auto') ?? '85')
  const revisao = parseInt(getConfig('fuzzy_score_revisao') ?? '70')
  return { auto, revisao }
}

export function findBestMatch(
  nomeVisita: string,
  candidatos: Array<{ id: number; nome_canonico: string }>
): { id: number; nome: string; score: number } | null {
  const norm = normalizeForMatch(nomeVisita)
  let best: { id: number; nome: string; score: number } | null = null

  for (const c of candidatos) {
    const score: number = fuzz.token_sort_ratio(norm, normalizeForMatch(c.nome_canonico))
    if (!best || score > best.score) {
      best = { id: c.id, nome: c.nome_canonico, score }
    }
  }
  return best
}

export function matchVisitasComPrescritores(
  nomesVisita: string[],
  uploadId: number
): MatchResult[] {
  const db = getDb()
  const { auto, revisao } = getThresholds()

  // Verificar aliases já confirmados
  const aliases = db.prepare(`
    SELECT pa.nome_variante, pa.prescritor_id, p.nome_canonico
    FROM prescritor_aliases pa
    JOIN prescritores p ON p.id = pa.prescritor_id
    WHERE pa.confirmado = 1
  `).all() as Array<{ nome_variante: string; prescritor_id: number; nome_canonico: string }>

  const aliasMap = new Map<string, { prescritor_id: number; nome_canonico: string }>()
  for (const a of aliases) {
    aliasMap.set(normalizeForMatch(a.nome_variante), { prescritor_id: a.prescritor_id, nome_canonico: a.nome_canonico })
  }

  // Todos os prescritores conhecidos
  const prescritores = db.prepare('SELECT id, nome_canonico FROM prescritores').all() as Array<{ id: number; nome_canonico: string }>

  const results: MatchResult[] = []
  const nomesUnicos = [...new Set(nomesVisita)]

  for (const nomeVisita of nomesUnicos) {
    const normVisita = normalizeForMatch(nomeVisita)

    // Verificar alias exato
    const aliasExato = aliasMap.get(normVisita)
    if (aliasExato) {
      results.push({
        nome_visita: nomeVisita,
        nome_candidato: aliasExato.nome_canonico,
        prescritor_id: aliasExato.prescritor_id,
        score: 100,
        tipo: 'automatico',
      })
      continue
    }

    if (prescritores.length === 0) {
      results.push({ nome_visita: nomeVisita, nome_candidato: '', prescritor_id: 0, score: 0, tipo: 'nao_associado' })
      continue
    }

    const best = findBestMatch(nomeVisita, prescritores)
    if (!best) {
      results.push({ nome_visita: nomeVisita, nome_candidato: '', prescritor_id: 0, score: 0, tipo: 'nao_associado' })
      continue
    }

    if (best.score >= auto) {
      results.push({ nome_visita: nomeVisita, nome_candidato: best.nome, prescritor_id: best.id, score: best.score, tipo: 'automatico' })
      // Salvar alias automaticamente
      db.prepare(`
        INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado)
        VALUES (?, ?, 'visita', 1)
      `).run(best.id, nomeVisita)
    } else if (best.score >= revisao) {
      results.push({ nome_visita: nomeVisita, nome_candidato: best.nome, prescritor_id: best.id, score: best.score, tipo: 'revisao' })
      // Salvar como match pendente
      db.prepare(`
        INSERT OR IGNORE INTO matches_pendentes (nome_visita, nome_candidato, score, upload_id)
        VALUES (?, ?, ?, ?)
      `).run(nomeVisita, best.nome, best.score, uploadId)
    } else {
      results.push({ nome_visita: nomeVisita, nome_candidato: best.nome, prescritor_id: 0, score: best.score, tipo: 'nao_associado' })
    }
  }

  return results
}

export function reprocessarMatchesPendentes() {
  const db = getDb()
  const { auto, revisao } = getThresholds()
  const prescritores = db.prepare('SELECT id, nome_canonico FROM prescritores').all() as Array<{ id: number; nome_canonico: string }>

  // Visitas sem prescritor associado
  const visitasSemMatch = db.prepare(`
    SELECT DISTINCT nome_cliente_bruto FROM visitas
    WHERE prescritor_id IS NULL
  `).all() as Array<{ nome_cliente_bruto: string }>

  for (const { nome_cliente_bruto } of visitasSemMatch) {
    const best = findBestMatch(nome_cliente_bruto, prescritores)
    if (!best) continue

    if (best.score >= auto) {
      db.prepare(`UPDATE visitas SET prescritor_id = ?, match_score = ?, match_confirmado = 1 WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL`).run(best.id, best.score, nome_cliente_bruto)
      db.prepare(`INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, 'visita', 1)`).run(best.id, nome_cliente_bruto)
    } else if (best.score >= revisao) {
      db.prepare(`UPDATE visitas SET match_score = ? WHERE nome_cliente_bruto = ? AND prescritor_id IS NULL`).run(best.score, nome_cliente_bruto)
      // Atualizar match pendente se existir
      db.prepare(`
        INSERT OR IGNORE INTO matches_pendentes (nome_visita, nome_candidato, score, upload_id)
        VALUES (?, ?, ?, NULL)
      `).run(nome_cliente_bruto, best.nome, best.score)
    }
  }
}
