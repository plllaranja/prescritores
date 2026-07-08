import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calcularMetricas } from '@/lib/metrics'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function coletarContexto() {
  const db = getDb()

  // Últimos 3 meses com dados
  const periodos = db.prepare(
    'SELECT DISTINCT mes, ano FROM vendas_mensais ORDER BY ano DESC, mes DESC LIMIT 3'
  ).all() as Array<{ mes: number; ano: number }>
  const meses = periodos.map(p => p.mes)
  const anos = periodos.map(p => p.ano)

  // Métricas por prescritor
  const metricas = calcularMetricas({ meses, anos })

  // Resumo por categoria
  const porCategoria: Record<string, number> = {}
  for (const m of metricas) {
    porCategoria[m.categoria] = (porCategoria[m.categoria] ?? 0) + 1
  }

  // Representantes e suas visitas
  const representantes = db.prepare(`
    SELECT r.nome, r.territorio,
      COUNT(DISTINCT v.id) as total_visitas,
      COUNT(DISTINCT v.prescritor_id) as prescritores_visitados,
      MAX(v.data_visita) as ultima_visita
    FROM representantes r
    LEFT JOIN visitas v ON v.representante_id = r.id
    WHERE r.ativo = 1
    GROUP BY r.id
  `).all() as Array<{ nome: string; territorio: string; total_visitas: number; prescritores_visitados: number; ultima_visita: string }>

  // Ranking visitas por mês por rep
  const visitasPorMes = db.prepare(`
    SELECT r.nome as representante, strftime('%Y-%m', v.data_visita) as mes_ano, COUNT(*) as visitas
    FROM visitas v JOIN representantes r ON r.id = v.representante_id
    GROUP BY r.id, mes_ano
    ORDER BY mes_ano DESC, visitas DESC
  `).all() as Array<{ representante: string; mes_ano: string; visitas: number }>

  // Top 20 prescritores por valor
  const topPrescritores = metricas
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 20)
    .map(m => ({
      nome: m.nome_canonico,
      categoria: m.categoria,
      valor_total: m.valor_total,
      tendencia: m.tendencia,
      classe_abc: m.classe_abc,
      roi_visita: m.roi_visita,
      foi_visitado: m.foi_visitado,
    }))

  // Prescritores em risco
  const emRisco = metricas
    .filter(m => m.categoria === 'risco' || m.categoria === 'reativacao')
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 15)
    .map(m => ({ nome: m.nome_canonico, categoria: m.categoria, valor_total: m.valor_total, foi_visitado: m.foi_visitado }))

  return {
    periodo_analisado: periodos.map(p => `${p.mes}/${p.ano}`).join(', '),
    total_prescritores: metricas.length,
    por_categoria: porCategoria,
    representantes,
    visitas_por_mes: visitasPorMes,
    top_prescritores: topPrescritores,
    em_risco: emRisco,
  }
}

const SYSTEM_PROMPT = `Você é um analista comercial especializado da Le Farma, uma empresa farmacêutica.
Você tem acesso a dados reais do sistema de acompanhamento de prescritores e representantes comerciais.
Responda sempre em português, de forma direta e útil.
Use os dados fornecidos para dar respostas precisas com números reais.
Quando relevante, sugira ações concretas (ex: "priorize no cronograma", "agende visita urgente").
Seja conciso mas completo. Use listas quando ajudar a clareza.`

export async function POST(req: NextRequest) {
  const { mensagem, historico } = await req.json() as {
    mensagem: string
    historico?: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!mensagem?.trim()) {
    return NextResponse.json({ erro: 'Mensagem vazia' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      resposta: 'Chave da API OpenAI não configurada. Adicione OPENAI_API_KEY no arquivo .env.local.',
      erro: 'sem_api_key'
    }, { status: 200 })
  }

  const contexto = coletarContexto()

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nDADOS ATUAIS DO SISTEMA:\n${JSON.stringify(contexto, null, 2)}`
    },
    ...(historico ?? []),
    { role: 'user', content: mensagem }
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.3,
    max_tokens: 1000,
  })

  const resposta = completion.choices[0].message.content ?? 'Sem resposta.'

  return NextResponse.json({ resposta })
}
