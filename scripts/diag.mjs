import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'data.db'))

console.log('\n=== DIAGNÓSTICO COMPLETO ===\n')

// 1. Visitas
const v = db.prepare(`SELECT COUNT(*) c, SUM(CASE WHEN prescritor_id IS NOT NULL THEN 1 ELSE 0 END) linked FROM visitas`).get()
console.log(`Visitas: ${v.c} total, ${v.linked} com prescritor_id`)

// 2. Vendas
const vm = db.prepare(`SELECT COUNT(*) c, COUNT(DISTINCT prescritor_id) presc, COUNT(DISTINCT mes||'/'||ano) periodos FROM vendas_mensais`).get()
console.log(`Vendas mensais: ${v.c} linhas, ${vm.presc} prescritores, períodos: ${vm.periodos}`)

// 3. Períodos disponíveis
const periodos = db.prepare(`SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano, mes`).all()
console.log(`Períodos: ${periodos.map(p => `${p.mes}/${p.ano}`).join(', ')}`)

// 4. Overlap: prescritores que aparecem em AMBOS (vendas + visitas linkadas)
const overlap = db.prepare(`
  SELECT COUNT(DISTINCT vm.prescritor_id) cnt
  FROM vendas_mensais vm
  WHERE vm.prescritor_id IN (SELECT DISTINCT prescritor_id FROM visitas WHERE prescritor_id IS NOT NULL)
`).get()
console.log(`\nOverlap vendas ↔ visitas: ${overlap.cnt} prescritores em comum`)

// 5. Amostra dos 5 prescritores com mais vendas, e se foram visitados
const top = db.prepare(`
  SELECT p.nome_canonico, SUM(vm.valor_total) receita,
    (SELECT COUNT(*) FROM visitas vi WHERE vi.prescritor_id = p.id) visitas_total
  FROM vendas_mensais vm
  JOIN prescritores p ON p.id = vm.prescritor_id
  GROUP BY p.id ORDER BY receita DESC LIMIT 5
`).all()
console.log('\nTop 5 prescritores por receita:')
top.forEach(r => console.log(`  ${r.nome_canonico}: R$${r.receita.toFixed(0)} | visitas: ${r.visitas_total}`))

// 6. Verificar datas das visitas
const datas = db.prepare(`SELECT MIN(data_visita) min, MAX(data_visita) max FROM visitas`).get()
console.log(`\nDatas visitas: de ${datas.min} até ${datas.max}`)

// 7. Visitas por mês
const vMes = db.prepare(`
  SELECT strftime('%Y-%m', data_visita) mes, COUNT(*) cnt
  FROM visitas GROUP BY 1 ORDER BY 1
`).all()
console.log('Visitas por mês:', vMes.map(r => `${r.mes}(${r.cnt})`).join(', '))

// 8. Prescritores com vendas em Apr-Jun/2026 que foram visitados
const positivados = db.prepare(`
  SELECT COUNT(DISTINCT vm.prescritor_id) cnt
  FROM vendas_mensais vm
  WHERE vm.mes IN (4,5,6) AND vm.ano = 2026 AND vm.valor_total > 0
    AND vm.prescritor_id IN (SELECT DISTINCT prescritor_id FROM visitas WHERE prescritor_id IS NOT NULL)
`).get()
const visitadosPeriodo = db.prepare(`
  SELECT COUNT(DISTINCT prescritor_id) cnt FROM visitas WHERE prescritor_id IS NOT NULL
`).get()
console.log(`\nPositivação calculada manualmente:`)
console.log(`  Visitados total: ${visitadosPeriodo.cnt}`)
console.log(`  Com vendas Abr-Jun/2026: ${positivados.cnt}`)
console.log(`  = ${visitadosPeriodo.cnt > 0 ? ((positivados.cnt/visitadosPeriodo.cnt)*100).toFixed(1) : 0}%`)

db.close()
