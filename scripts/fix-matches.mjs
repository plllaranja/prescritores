// Script: confirma matches pendentes e re-linka visitas com prescritores
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'data.db')
const db = new Database(DB_PATH)

// ── Diagnóstico ──────────────────────────────────────────────────────────────
const diag = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN score >= 85 THEN 1 ELSE 0 END) as auto_aprovavel,
    SUM(CASE WHEN score >= 70 AND score < 85 THEN 1 ELSE 0 END) as revisao_manual,
    SUM(CASE WHEN score < 70 THEN 1 ELSE 0 END) as sem_match
  FROM matches_pendentes WHERE resolvido = 0
`).get()

console.log('\n── matches_pendentes ──────────────────────────────────')
console.log(`  Total pendentes : ${diag.total}`)
console.log(`  Score ≥ 85      : ${diag.auto_aprovavel}  (auto-aprovável)`)
console.log(`  Score 70–84     : ${diag.revisao_manual}  (revisão manual)`)
console.log(`  Score < 70      : ${diag.sem_match}`)

const semLink = db.prepare(`SELECT COUNT(*) as cnt FROM visitas WHERE prescritor_id IS NULL`).get()
console.log(`\n  Visitas sem prescritor_id: ${semLink.cnt}`)

// ── 1. Confirmar matches_pendentes com score >= 70 automaticamente ───────────
const pendentes = db.prepare(`
  SELECT m.id, m.nome_visita, m.nome_candidato, p.id as pid
  FROM matches_pendentes m
  JOIN prescritores p ON p.nome_canonico = m.nome_candidato
  WHERE m.resolvido = 0 AND m.score >= 70
`).all()

let step1 = 0
db.transaction(() => {
  for (const m of pendentes) {
    db.prepare(`UPDATE matches_pendentes SET resolvido=1, resolucao='confirmado', prescritor_id_escolhido=? WHERE id=?`).run(m.pid, m.id)
    const r = db.prepare(`UPDATE visitas SET prescritor_id=?, match_confirmado=1 WHERE nome_cliente_bruto=? AND prescritor_id IS NULL`).run(m.pid, m.nome_visita)
    db.prepare(`INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?,?,'visita',1)`).run(m.pid, m.nome_visita)
    step1 += r.changes
  }
})()
console.log(`\n✓ Passo 1: ${step1} visitas linkadas via matches_pendentes (score ≥ 70)`)

// ── 2. Fuzzy re-matching das visitas ainda sem link (threshold: 60) ──────────
// Importar fuzzball via require (CJS)
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fuzz = require('fuzzball')

function normalize(s) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\bDR\.?\s*/g,'').replace(/\bDRA\.?\s*/g,'').replace(/\s+/g,' ').trim()
}

const prescritores = db.prepare('SELECT id, nome_canonico FROM prescritores').all()
const semPresc = db.prepare(`SELECT DISTINCT nome_cliente_bruto FROM visitas WHERE prescritor_id IS NULL`).all()

let step2 = 0
db.transaction(() => {
  for (const { nome_cliente_bruto } of semPresc) {
    const norm = normalize(nome_cliente_bruto)
    let best = null
    for (const p of prescritores) {
      const score = fuzz.token_sort_ratio(norm, normalize(p.nome_canonico))
      if (!best || score > best.score) best = { ...p, score }
    }
    if (!best || best.score < 60) continue
    const r = db.prepare(`UPDATE visitas SET prescritor_id=?, match_score=?, match_confirmado=1 WHERE nome_cliente_bruto=? AND prescritor_id IS NULL`).run(best.id, best.score, nome_cliente_bruto)
    db.prepare(`INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?,?,'visita',1)`).run(best.id, nome_cliente_bruto)
    step2 += r.changes
  }
})()
console.log(`✓ Passo 2: ${step2} visitas linkadas via fuzzy (threshold ≥ 60)`)

// ── Resultado final ──────────────────────────────────────────────────────────
const final = db.prepare(`SELECT COUNT(*) as cnt FROM visitas WHERE prescritor_id IS NULL`).get()
const total = db.prepare(`SELECT COUNT(*) as cnt FROM visitas`).get()
console.log(`\n── Resultado ──────────────────────────────────────────`)
console.log(`  Visitas com prescritor_id : ${total.cnt - final.cnt} / ${total.cnt}`)
console.log(`  Ainda sem link            : ${final.cnt}`)
console.log('\nPronto! Atualize o dashboard.\n')

db.close()
