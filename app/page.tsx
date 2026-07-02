'use client'
import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Users, Target, AlertTriangle, DollarSign, BarChart2, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CAT_LABELS: Record<string, string> = {
  top_roi: 'Top ROI', crescimento: 'Crescimento', reativacao: 'Reativação',
  risco: 'Risco', ativo_medio: 'Ativo Médio', ativo_regular: 'Ativo Regular',
  pontual: 'Pontual', sem_venda: 'Sem Venda',
}
const CAT_COLORS: Record<string, string> = {
  top_roi: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  crescimento: 'bg-green-500/20 text-green-300 border-green-500/30',
  reativacao: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  risco: 'bg-red-500/20 text-red-300 border-red-500/30',
  ativo_medio: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  ativo_regular: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  pontual: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  sem_venda: 'bg-gray-700/20 text-gray-500 border-gray-700/30',
}
const TEND_ICONS: Record<string, React.ReactNode> = {
  crescimento: <TrendingUp size={14} className="text-green-400" />,
  queda_forte: <TrendingDown size={14} className="text-red-400" />,
  queda_total: <TrendingDown size={14} className="text-red-600" />,
  estavel: <span className="text-gray-500 text-xs">—</span>,
  nunca_comprou: <span className="text-gray-600 text-xs">∅</span>,
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
function fmtPct(v: number | null) { return v == null ? '—' : v.toFixed(1) + '%' }

interface KPI { total_visitas: number; positivacao_media: number; roi_medio: number; prescritores_em_risco: number; receita_total: number }
interface Periodo { mes: number; ano: number }
interface Metrica {
  prescritor_id: number; nome_canonico: string; tipo_entidade: string; valor_total: number
  tendencia: string; categoria: string; consistencia: string; classe_abc: string
  roi_visita: number | null; foi_visitado: boolean; representantes: string[]
  meses_com_venda: number; prioridade_score: number
}
interface RepIndicador {
  representante_id: number; nome: string; territorio: string | null
  visitas_realizadas: number; cobertura_carteira_pct: number | null
  positivacao_pct: number | null; receita_por_visita: number | null
  prescritores_em_risco: number; prescritores_novos_ativados: number
}
interface DashData {
  kpis: KPI; metricas: Metrica[]; alertas: unknown[]; evolucao: unknown[]
  indicadores_representantes: RepIndicador[]
  periodos_disponiveis: Periodo[]; periodo_selecionado: Periodo[]
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [ordem, setOrdem] = useState<keyof Metrica>('valor_total')
  const [ordemDir, setOrdemDir] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async (params = '') => {
    setLoading(true)
    const res = await fetch(`/api/dashboard${params ? '?' + params : ''}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <RefreshCw size={20} className="animate-spin" /> Carregando dados...
    </div>
  )

  if (!data || data.periodos_disponiveis.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
      <BarChart2 size={48} className="text-gray-700" />
      <p className="text-lg">Nenhum dado importado ainda.</p>
      <a href="/importacao" className="text-blue-400 hover:underline text-sm">Ir para Importação →</a>
    </div>
  )

  const { kpis, metricas, alertas, indicadores_representantes } = data

  const metricasFiltradas = metricas
    .filter(m =>
      (!busca || m.nome_canonico.toLowerCase().includes(busca.toLowerCase())) &&
      (!catFiltro || m.categoria === catFiltro)
    )
    .sort((a, b) => {
      const va = a[ordem] as number | null ?? 0
      const vb = b[ordem] as number | null ?? 0
      return ordemDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })

  const toggleOrdem = (col: keyof Metrica) => {
    if (ordem === col) setOrdemDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setOrdem(col); setOrdemDir('desc') }
  }

  const evolucaoMensal = (() => {
    const mapa = new Map<string, Record<string, number>>()
    for (const e of data.evolucao as Array<{ mes: number; ano: number; receita: number; representante: string }>) {
      const key = `${MESES[e.mes]}/${String(e.ano).slice(2)}`
      if (!mapa.has(key)) mapa.set(key, { name: key as unknown as number } as Record<string, number>)
      const rep = e.representante ?? 'Sem rep.'
      mapa.get(key)![rep] = (mapa.get(key)![rep] ?? 0) + (e.receita ?? 0)
    }
    return [...mapa.values()]
  })()

  const repsNomes = [...new Set((data.evolucao as Array<{ representante: string }>).map(e => e.representante).filter(Boolean))]
  const LINE_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Período: {data.periodo_selecionado.map(p => `${MESES[p.mes]}/${p.ano}`).join(', ')}
          </p>
        </div>
        <button onClick={() => fetchData()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 hover:border-gray-500 transition">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total de Visitas" value={kpis.total_visitas.toString()} icon={<Users size={20} />} color="blue" />
        <KpiCard label="Positivação Média" value={fmtPct(kpis.positivacao_media)} icon={<Target size={20} />} color="green" highlight />
        <KpiCard label="R$/Visita Médio" value={fmt(kpis.roi_medio)} icon={<DollarSign size={20} />} color="yellow" />
        <KpiCard label="Prescritores em Risco" value={kpis.prescritores_em_risco.toString()} icon={<AlertTriangle size={20} />} color="red" />
      </div>

      {/* Representantes */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-1">Comparativo de Representantes</h2>
        <p className="text-xs text-gray-500 mb-4">Comparação entre territórios deve considerar diferença de deslocamento entre Curitiba e Ponta Grossa.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left pb-2">Representante</th>
                <th className="text-left pb-2">Território</th>
                <th className="text-right pb-2 text-green-400 font-semibold">Positivação</th>
                <th className="text-right pb-2">Cobertura</th>
                <th className="text-right pb-2">R$/Visita</th>
                <th className="text-right pb-2">Visitas</th>
                <th className="text-right pb-2">Em Risco</th>
                <th className="text-right pb-2">Novos Ativados</th>
              </tr>
            </thead>
            <tbody>
              {indicadores_representantes.map(r => (
                <tr key={r.representante_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2.5 font-medium text-white">{r.nome}</td>
                  <td className="py-2.5 text-gray-400">{r.territorio ?? <span className="text-yellow-600 text-xs">Não definido</span>}</td>
                  <td className="py-2.5 text-right font-bold text-green-400">{fmtPct(r.positivacao_pct)}</td>
                  <td className="py-2.5 text-right text-gray-300">{r.cobertura_carteira_pct == null ? '—' : fmtPct(r.cobertura_carteira_pct)}</td>
                  <td className="py-2.5 text-right text-gray-300">{r.receita_por_visita == null ? '—' : fmt(r.receita_por_visita)}</td>
                  <td className="py-2.5 text-right text-gray-300">{r.visitas_realizadas}</td>
                  <td className="py-2.5 text-right text-red-400">{r.prescritores_em_risco}</td>
                  <td className="py-2.5 text-right text-blue-400">{r.prescritores_novos_ativados}</td>
                </tr>
              ))}
              {indicadores_representantes.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-gray-600">Sem dados de representantes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gráfico evolução */}
      {evolucaoMensal.length > 0 && (
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="font-semibold text-white mb-4">Evolução Mensal de Receita por Representante</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => fmt(v)} width={90} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend />
              {repsNomes.map((r, i) => (
                <Line key={r} type="monotone" dataKey={r} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <section className="bg-gray-900 rounded-xl border border-red-900/30 p-5">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" /> Alertas ({alertas.length})
          </h2>
          <div className="space-y-2">
            {(alertas as Array<{ nome: string; categoria: string; tendencia: string; valor_total: number; foi_visitado: boolean }>).slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-2.5">
                <div>
                  <span className="text-white font-medium">{a.nome}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded border ${CAT_COLORS[a.categoria]}`}>
                    {CAT_LABELS[a.categoria]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{fmt(a.valor_total)}</span>
                  {a.foi_visitado ? <span className="text-yellow-600 text-xs">visitado</span> : <span className="text-red-600 text-xs">sem visita</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabela prescritores */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="font-semibold text-white">Prescritores ({metricasFiltradas.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar prescritor..."
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
            />
            <select
              value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-left">
                <th className="pb-2 pr-4">Prescritor</th>
                <th className="pb-2 pr-4">Rep.</th>
                <th className="pb-2 pr-2 cursor-pointer hover:text-white" onClick={() => toggleOrdem('categoria')}>Categoria</th>
                <th className="pb-2 pr-2 cursor-pointer hover:text-white text-right" onClick={() => toggleOrdem('valor_total')}>Receita {ordem === 'valor_total' ? (ordemDir === 'desc' ? '↓' : '↑') : ''}</th>
                <th className="pb-2 pr-2 cursor-pointer hover:text-white text-right" onClick={() => toggleOrdem('roi_visita')}>ROI/Visita {ordem === 'roi_visita' ? (ordemDir === 'desc' ? '↓' : '↑') : ''}</th>
                <th className="pb-2 pr-2 text-right">Tendência</th>
                <th className="pb-2 text-center">ABC</th>
                <th className="pb-2 text-center">Consistência</th>
              </tr>
            </thead>
            <tbody>
              {metricasFiltradas.slice(0, 100).map(m => (
                <tr key={m.prescritor_id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-medium text-white max-w-[200px] truncate">{m.nome_canonico}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{m.representantes[0] ?? '—'}</td>
                  <td className="py-2 pr-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${CAT_COLORS[m.categoria]}`}>{CAT_LABELS[m.categoria]}</span>
                  </td>
                  <td className="py-2 pr-2 text-right text-gray-200">{fmt(m.valor_total)}</td>
                  <td className="py-2 pr-2 text-right text-gray-400">{m.roi_visita == null ? '—' : fmt(m.roi_visita)}</td>
                  <td className="py-2 pr-2 text-right">{TEND_ICONS[m.tendencia] ?? m.tendencia}</td>
                  <td className="py-2 text-center">
                    <span className={`text-xs font-bold ${m.classe_abc === 'A' ? 'text-green-400' : m.classe_abc === 'B' ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {m.classe_abc}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`text-xs ${m.consistencia === 'consistente' ? 'text-green-400' : m.consistencia === 'parcial' ? 'text-yellow-400' : m.consistencia === 'pontual' ? 'text-orange-400' : 'text-gray-600'}`}>
                      {m.consistencia}
                    </span>
                  </td>
                </tr>
              ))}
              {metricasFiltradas.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-600">Nenhum prescritor encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, icon, color, highlight }: { label: string; value: string; icon: React.ReactNode; color: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-800/50 bg-blue-950/20',
    green: 'border-green-700/50 bg-green-950/20',
    yellow: 'border-yellow-800/50 bg-yellow-950/20',
    red: 'border-red-800/50 bg-red-950/20',
  }
  const iconColors: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400', red: 'text-red-400'
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]} ${highlight ? 'ring-2 ring-green-600/30' : ''}`}>
      <div className={`${iconColors[color]} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-green-300 font-medium' : 'text-gray-400'}`}>{label}</p>
    </div>
  )
}
