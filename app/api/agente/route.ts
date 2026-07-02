import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calcularMetricas } from '@/lib/metrics'

type Intencao = 'queda' | 'representante' | 'risco' | 'roi' | 'comparar' | 'positivacao' | 'desconhecida'

function detectarIntencao(texto: string): { intencao: Intencao; entidades: Record<string, string> } {
  const lower = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (/cai(u|ram)|queda|diminui|pior(ou|aram)|reduzi/.test(lower)) {
    return { intencao: 'queda', entidades: { periodo: extrairPeriodo(lower) } }
  }
  if (/risco|abandon(ou|aram)|sem visita|sumiu|desapareceu/.test(lower)) {
    return { intencao: 'risco', entidades: {} }
  }
  if (/roi|retorn(a|ou)|melhor.*visita|visita.*melhor/.test(lower)) {
    return { intencao: 'roi', entidades: {} }
  }
  if (/positiva(cao|ção)|converteu|vendeu/.test(lower)) {
    return { intencao: 'positivacao', entidades: {} }
  }
  if (/compara(r|ndo)|vs\.?|versus/.test(lower)) {
    return { intencao: 'comparar', entidades: {} }
  }
  if (/representante|anna|paula|brito/.test(lower)) {
    const nomeMatch = lower.match(/representante\s+(\w+)/)
    return { intencao: 'representante', entidades: { nome: nomeMatch?.[1] ?? '' } }
  }

  return { intencao: 'desconhecida', entidades: {} }
}

function extrairPeriodo(texto: string): string {
  if (/mes.*(passado|atual)|ultimo.?mes/.test(texto)) return 'ultimo_mes'
  if (/trimestre/.test(texto)) return 'trimestre'
  return 'periodo_atual'
}

function getUltimosMeses(n: number): { meses: number[]; anos: number[] } {
  const db = getDb()
  const periodos = db.prepare('SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano DESC, mes DESC LIMIT ?').all(n) as Array<{ mes: number; ano: number }>
  return { meses: periodos.map(p => p.mes), anos: periodos.map(p => p.ano) }
}

export async function POST(req: NextRequest) {
  const { mensagem } = await req.json()
  if (!mensagem?.trim()) return NextResponse.json({ erro: 'Mensagem vazia' }, { status: 400 })

  const db = getDb()
  const { intencao, entidades } = detectarIntencao(mensagem)
  const { meses, anos } = getUltimosMeses(3)

  let resposta: string
  let dados: unknown = null
  let sugestoes: string[] = []

  switch (intencao) {
    case 'queda': {
      const metricas = calcularMetricas({ meses, anos })
      const emQueda = metricas
        .filter(m => m.tendencia === 'queda_forte' || m.tendencia === 'queda_total')
        .sort((a, b) => b.valor_total - a.valor_total)
        .slice(0, 10)

      if (emQueda.length === 0) {
        resposta = 'Não há prescritores com queda forte no período atual.'
      } else {
        resposta = `Encontrei ${emQueda.length} prescritores com queda no período. Para cada um, analiso se a queda foi gradual ou abrupta antes de qualquer recomendação de ação:`
        dados = emQueda.map(m => ({
          nome: m.nome_canonico,
          tendencia: m.tendencia,
          valor_total: m.valor_total,
          foi_visitado: m.foi_visitado,
          categoria: m.categoria,
          diagnostico: m.tendencia === 'queda_total'
            ? m.foi_visitado ? '⚠️ Queda total — visitado. Verificar se há produto substituto ou mudança de perfil.' : '🔴 Queda total sem visita recente. Requer contato urgente.'
            : m.foi_visitado ? '⚠️ Em queda, mas visitado. Checar abordagem e histórico de relacionamento.' : '🔴 Em queda e sem visita. Priorizar na agenda.'
        }))
        sugestoes = ['Adicionar ao cronograma como reativação', 'Ver quem está em risco']
      }
      break
    }

    case 'risco': {
      const metricas = calcularMetricas({ meses, anos })
      const emRisco = metricas.filter(m => m.categoria === 'risco' || m.categoria === 'reativacao')
        .sort((a, b) => b.valor_total - a.valor_total)

      resposta = emRisco.length > 0
        ? `${emRisco.length} prescritores em situação de risco ou necessitando reativação:`
        : 'Nenhum prescritor em risco no período atual.'
      dados = emRisco.map(m => ({
        nome: m.nome_canonico,
        categoria: m.categoria,
        valor_total: m.valor_total,
        tendencia: m.tendencia,
        foi_visitado: m.foi_visitado,
      }))
      sugestoes = ['Adicionar ao cronograma', 'Ver representante responsável']
      break
    }

    case 'roi': {
      const metricas = calcularMetricas({ meses, anos })
      const ranking = metricas
        .filter(m => m.roi_visita !== null)
        .sort((a, b) => (b.roi_visita ?? 0) - (a.roi_visita ?? 0))
        .slice(0, 10)

      resposta = ranking.length > 0
        ? `Top ${ranking.length} prescritores por ROI de visita (R$ de receita por visita realizada):`
        : 'Sem dados suficientes de visitas para calcular ROI.'
      dados = ranking.map((m, i) => ({
        posicao: i + 1,
        nome: m.nome_canonico,
        roi_visita: m.roi_visita,
        valor_total: m.valor_total,
        classe_abc: m.classe_abc,
      }))
      break
    }

    case 'positivacao': {
      const indicadores = db.prepare(`
        SELECT r.nome, r.territorio,
          COUNT(DISTINCT v.prescritor_id) as visitados,
          COUNT(DISTINCT CASE WHEN vm.valor_total > 0 THEN v.prescritor_id END) as com_venda
        FROM representantes r
        LEFT JOIN visitas v ON v.representante_id = r.id
          AND strftime('%Y', v.data_visita) = CAST(? AS TEXT)
          AND strftime('%m', v.data_visita) = printf('%02d', ?)
        LEFT JOIN vendas_mensais vm ON vm.prescritor_id = v.prescritor_id AND vm.mes = ? AND vm.ano = ?
        WHERE r.ativo = 1
        GROUP BY r.id
      `).all(anos[0] ?? 2025, meses[0] ?? 1, meses[0] ?? 1, anos[0] ?? 2025) as Array<{ nome: string; territorio: string; visitados: number; com_venda: number }>

      resposta = 'Taxa de positivação por representante (visitados que geraram venda no mesmo mês):'
      dados = indicadores.map(i => ({
        representante: i.nome,
        territorio: i.territorio,
        visitados: i.visitados,
        com_venda: i.com_venda,
        positivacao_pct: i.visitados > 0 ? ((i.com_venda / i.visitados) * 100).toFixed(1) + '%' : 'N/A'
      }))
      break
    }

    case 'representante': {
      const nomeBusca = entidades.nome
      const rep = db.prepare(`SELECT * FROM representantes WHERE nome LIKE ?`).get(`%${nomeBusca}%`) as { id: number; nome: string; territorio: string } | undefined
      if (!rep) {
        resposta = `Não encontrei representante com o nome "${nomeBusca}". Representantes cadastrados:`
        dados = db.prepare('SELECT nome, territorio FROM representantes WHERE ativo = 1').all()
      } else {
        const metricas = calcularMetricas({ meses, anos, representante_ids: [rep.id] })
        const receita = metricas.reduce((s, m) => s + m.valor_total, 0)
        const visitasCount = db.prepare(`SELECT COUNT(*) as cnt FROM visitas WHERE representante_id = ?`).get(rep.id) as { cnt: number }
        resposta = `Resumo do representante ${rep.nome} (${rep.territorio ?? 'território não definido'}):`
        dados = {
          nome: rep.nome,
          territorio: rep.territorio,
          total_visitas: visitasCount.cnt,
          prescritores_na_carteira: metricas.length,
          receita_total_periodo: receita,
          por_categoria: Object.fromEntries(
            ['top_roi','crescimento','reativacao','risco','ativo_medio','ativo_regular','pontual','sem_venda'].map(cat => [
              cat, metricas.filter(m => m.categoria === cat).length
            ])
          )
        }
      }
      break
    }

    default: {
      resposta = `Não identifiquei com clareza o que você quer consultar em "${mensagem}". Tente uma das perguntas abaixo:`
      sugestoes = [
        'Quem caiu mais esse mês?',
        'Quem está em risco de abandono?',
        'Qual o melhor ROI por visita?',
        'Como está o representante [nome]?',
        'Qual a positivação de cada representante?',
      ]
      dados = null
      break
    }
  }

  return NextResponse.json({ intencao, resposta, dados, sugestoes })
}
