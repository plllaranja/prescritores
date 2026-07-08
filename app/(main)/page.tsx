'use client'
import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Users, Target, AlertTriangle, DollarSign, BarChart2, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CAT_LABELS: Record<string, string> = {
  top_roi: 'Top ROI', crescimento: 'Crescimento', reativacao: 'Reativação',
  risco: 'Risco', ativo_medio: 'Ativo Médio', ativo_regular: 'Ativo Regular',
  pontual: 'Pontual', sem_venda: 'Sem Venda',
}
const CAT_BG: Record<string, string> = {
  top_roi: '#FFF8CC', crescimento: '#EEF5D6', reativacao: '#FFF0E0',
  risco: '#FEE8E8', ativo_medio: '#E7F8FF', ativo_regular: '#EAF0FF',
  pontual: '#F3F4F6', sem_venda: '#F9FAFB',
}
const CAT_COLOR: Record<string, string> = {
  top_roi: '#A07C00', crescimento: '#4A7000', reativacao: '#CC5500',
  risco: '#CC1111', ativo_medio: '#007AB8', ativo_regular: '#2C4A9A',
  pontual: '#6B7280', sem_venda: '#9CA3AF',
}
const TEND_ICONS: Record<string, React.ReactNode> = {
  crescimento: <TrendingUp size={14} style={{ color: '#88A201' }} />,
  queda_forte: <TrendingDown size={14} style={{ color: '#E53E3E' }} />,
  queda_total: <TrendingDown size={14} style={{ color: '#CC1111' }} />,
  estavel: <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>,
  nunca_comprou: <span style={{ color: '#CBD5E0', fontSize: 12 }}>∅</span>,
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
  const [sessionUser, setSessionUser] = useState<{ nome: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(u => { if (u.nome) setSessionUser(u) })
  }, [])

  const fetchData = useCallback(async (params = '') => {
    setLoading(true)
    const res = await fetch(`/api/dashboard${params ? '?' + params : ''}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3" style={{ color: '#009EE2' }}>
      <RefreshCw size={20} className="animate-spin" /> <span style={{ color: '#6B7280' }}>Carregando dados...</span>
    </div>
  )

  if (!data || !data.periodos_disponiveis || data.periodos_disponiveis.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4" style={{ color: '#9CA3AF' }}>
      <BarChart2 size={48} style={{ color: '#D1D5DB' }} />
      <p className="text-lg font-medium" style={{ color: '#6B7280' }}>Nenhum dado importado ainda.</p>
      <a href="/importacao" className="text-sm font-medium hover:underline" style={{ color: '#009EE2' }}>Ir para Importação →</a>
    </div>
  )

  // Aviso sem vendas
  const semVendas = (data as DashData & { tem_vendas?: boolean }).tem_vendas === false

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
  const LINE_COLORS = ['#009EE2', '#88A201', '#FFCB00', '#2C4A9A', '#FF6B35']

  return (
    <div className="space-y-6">
      {semVendas && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: '#FFF8CC', border: '1px solid #F0D800' }}>
          <AlertTriangle size={16} style={{ color: '#A07C00', flexShrink: 0 }} />
          <span style={{ color: '#A07C00' }}>
            Você importou visitas mas ainda não importou <strong>vendas</strong>. Métricas de receita e categorias ficarão disponíveis após importar a planilha de vendas.
          </span>
          <a href="/importacao" className="ml-auto text-xs font-medium underline flex-shrink-0" style={{ color: '#A07C00' }}>Importar vendas</a>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>
            {sessionUser?.role === 'rep' ? `Olá, ${sessionUser.nome.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            Período: {data.periodo_selecionado.map(p => `${MESES[p.mes]}/${p.ano}`).join(', ')}
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white"
          style={{ color: '#6B7280', border: '1px solid #E8E8E8', background: '#fff' }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total de Visitas" value={kpis.total_visitas.toString()} icon={<Users size={18} />} iconBg="#E7F8FF" iconColor="#009EE2" />
        <KpiCard label="Positivação Média" value={fmtPct(kpis.positivacao_media)} icon={<Target size={18} />} iconBg="#EEF5D6" iconColor="#88A201" highlight />
        <KpiCard label="R$/Visita Médio" value={fmt(kpis.roi_medio)} icon={<DollarSign size={18} />} iconBg="#FFF8CC" iconColor="#A07C00" />
        <KpiCard label="Prescritores em Risco" value={kpis.prescritores_em_risco.toString()} icon={<AlertTriangle size={18} />} iconBg="#FEE8E8" iconColor="#CC1111" />
      </div>

      {/* Representantes */}
      <section style={CARD} className="p-5">
        <h2 className="font-semibold mb-1" style={{ color: '#1A1A2E' }}>Comparativo de Representantes</h2>
        <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>Comparação entre territórios deve considerar diferença de deslocamento entre Curitiba e Ponta Grossa.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Representante', 'Território', 'Positivação', 'Cobertura', 'R$/Visita', 'Visitas', 'Em Risco', 'Novos'].map((h, i) => (
                  <th key={h} className={`pb-2.5 text-xs font-medium ${i >= 2 ? 'text-right' : 'text-left'} ${i === 0 ? 'pr-4' : 'pr-2'}`} style={{ color: '#9CA3AF' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicadores_representantes.map(r => (
                <tr key={r.representante_id} style={{ borderBottom: '1px solid #F9FAFB' }} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-2.5 pr-4 font-medium" style={{ color: '#1A1A2E' }}>{r.nome}</td>
                  <td className="py-2.5 pr-2" style={{ color: '#6B7280' }}>{r.territorio ?? <span className="text-xs font-medium" style={{ color: '#A07C00' }}>Não definido</span>}</td>
                  <td className="py-2.5 pr-2 text-right font-bold" style={{ color: '#88A201' }}>{fmtPct(r.positivacao_pct)}</td>
                  <td className="py-2.5 pr-2 text-right" style={{ color: '#6B7280' }}>{r.cobertura_carteira_pct == null ? '—' : fmtPct(r.cobertura_carteira_pct)}</td>
                  <td className="py-2.5 pr-2 text-right" style={{ color: '#6B7280' }}>{r.receita_por_visita == null ? '—' : fmt(r.receita_por_visita)}</td>
                  <td className="py-2.5 pr-2 text-right" style={{ color: '#6B7280' }}>{r.visitas_realizadas}</td>
                  <td className="py-2.5 pr-2 text-right font-medium" style={{ color: '#CC1111' }}>{r.prescritores_em_risco}</td>
                  <td className="py-2.5 text-right font-medium" style={{ color: '#009EE2' }}>{r.prescritores_novos_ativados}</td>
                </tr>
              ))}
              {indicadores_representantes.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-sm" style={{ color: '#D1D5DB' }}>Sem dados de representantes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gráfico evolução */}
      {evolucaoMensal.length > 0 && (
        <section style={CARD} className="p-5">
          <h2 className="font-semibold mb-4" style={{ color: '#1A1A2E' }}>Evolução Mensal de Receita por Representante</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={v => fmt(v)} width={90} />
              <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={{ background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8, fontSize: 12 }} />
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
        <section style={{ ...CARD, border: '1px solid #FECACA' }} className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#1A1A2E' }}>
            <AlertTriangle size={18} style={{ color: '#CC1111' }} /> Alertas ({alertas.length})
          </h2>
          <div className="space-y-2">
            {(alertas as Array<{ nome: string; categoria: string; tendencia: string; valor_total: number; foi_visitado: boolean }>).slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-4 py-2.5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="flex items-center gap-3">
                  <span className="font-medium" style={{ color: '#1A1A2E' }}>{a.nome}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: CAT_BG[a.categoria], color: CAT_COLOR[a.categoria] }}>
                    {CAT_LABELS[a.categoria]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span style={{ color: '#6B7280' }}>{fmt(a.valor_total)}</span>
                  {a.foi_visitado
                    ? <span className="text-xs font-medium" style={{ color: '#A07C00' }}>visitado</span>
                    : <span className="text-xs font-medium" style={{ color: '#CC1111' }}>sem visita</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabela prescritores */}
      <section style={CARD} className="p-5">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="font-semibold" style={{ color: '#1A1A2E' }}>Prescritores ({metricasFiltradas.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar prescritor..."
              className="text-sm rounded-lg px-3 py-1.5 w-48 focus:outline-none"
              style={{ border: '1px solid #E8E8E8', color: '#1A1A2E', background: '#F9FAFB' }}
            />
            <select
              value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 focus:outline-none"
              style={{ border: '1px solid #E8E8E8', color: '#1A1A2E', background: '#F9FAFB' }}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0', background: '#FAFAFA' }}>
                <th className="pb-2.5 pt-2 px-2 text-left text-xs font-medium" style={{ color: '#9CA3AF' }}>Prescritor</th>
                <th className="pb-2.5 pt-2 px-2 text-left text-xs font-medium" style={{ color: '#9CA3AF' }}>Rep.</th>
                <th className="pb-2.5 pt-2 px-2 text-xs font-medium cursor-pointer" style={{ color: '#9CA3AF' }} onClick={() => toggleOrdem('categoria')}>Categoria</th>
                <th className="pb-2.5 pt-2 px-2 text-right text-xs font-medium cursor-pointer" style={{ color: '#9CA3AF' }} onClick={() => toggleOrdem('valor_total')}>Receita {ordem === 'valor_total' ? (ordemDir === 'desc' ? '↓' : '↑') : ''}</th>
                <th className="pb-2.5 pt-2 px-2 text-right text-xs font-medium cursor-pointer" style={{ color: '#9CA3AF' }} onClick={() => toggleOrdem('roi_visita')}>ROI/Visita {ordem === 'roi_visita' ? (ordemDir === 'desc' ? '↓' : '↑') : ''}</th>
                <th className="pb-2.5 pt-2 px-2 text-right text-xs font-medium" style={{ color: '#9CA3AF' }}>Tendência</th>
                <th className="pb-2.5 pt-2 px-2 text-center text-xs font-medium" style={{ color: '#9CA3AF' }}>ABC</th>
                <th className="pb-2.5 pt-2 px-2 text-center text-xs font-medium" style={{ color: '#9CA3AF' }}>Consistência</th>
              </tr>
            </thead>
            <tbody>
              {metricasFiltradas.slice(0, 100).map(m => (
                <tr key={m.prescritor_id} style={{ borderBottom: '1px solid #F9FAFB' }} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-2.5 px-2 font-medium max-w-[200px] truncate" style={{ color: '#1A1A2E' }}>{m.nome_canonico}</td>
                  <td className="py-2.5 px-2 text-xs" style={{ color: '#9CA3AF' }}>{m.representantes[0] ?? '—'}</td>
                  <td className="py-2.5 px-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: CAT_BG[m.categoria], color: CAT_COLOR[m.categoria] }}>
                      {CAT_LABELS[m.categoria]}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium" style={{ color: '#1A1A2E' }}>{fmt(m.valor_total)}</td>
                  <td className="py-2.5 px-2 text-right" style={{ color: '#6B7280' }}>{m.roi_visita == null ? '—' : fmt(m.roi_visita)}</td>
                  <td className="py-2.5 px-2 text-right">{TEND_ICONS[m.tendencia] ?? m.tendencia}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="text-xs font-bold" style={{ color: m.classe_abc === 'A' ? '#88A201' : m.classe_abc === 'B' ? '#A07C00' : '#D1D5DB' }}>
                      {m.classe_abc}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="text-xs" style={{ color: m.consistencia === 'consistente' ? '#88A201' : m.consistencia === 'parcial' ? '#A07C00' : m.consistencia === 'pontual' ? '#CC5500' : '#D1D5DB' }}>
                      {m.consistencia}
                    </span>
                  </td>
                </tr>
              ))}
              {metricasFiltradas.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm" style={{ color: '#D1D5DB' }}>Nenhum prescritor encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, icon, iconBg, iconColor, highlight }: {
  label: string; value: string; icon: React.ReactNode
  iconBg: string; iconColor: string; highlight?: boolean
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: highlight ? '1px solid #C6E6A0' : '1px solid #F0F0F0', padding: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        {icon}
      </div>
      <p className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: highlight ? '#88A201' : '#9CA3AF', fontWeight: highlight ? 600 : 400 }}>{label}</p>
    </div>
  )
}
