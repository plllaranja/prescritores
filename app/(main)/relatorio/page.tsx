'use client'
import { useState, useEffect } from 'react'
import { Download, Printer, RefreshCw, TrendingUp, Users, CheckCircle, BarChart3 } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const CAT_LABEL: Record<string, string> = {
  top_roi: 'Top ROI', crescimento: 'Crescimento', reativacao: 'Reativação',
  risco: 'Risco', ativo_medio: 'Ativo Médio', ativo_regular: 'Ativo Regular',
  pontual: 'Pontual', sem_venda: 'Sem Venda',
}

const CAT_COLOR: Record<string, string> = {
  top_roi: '#A07C00', crescimento: '#4A7000', reativacao: '#CC5500',
  risco: '#CC1111', ativo_medio: '#007AB8', ativo_regular: '#2C4A9A',
  pontual: '#6B7280', sem_venda: '#9CA3AF',
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

interface Relatorio {
  periodo: { mes: number; ano: number }
  resumo: {
    total_visitas_importadas: number
    total_cronograma: number
    realizadas_cronograma: number
    taxa_execucao: string
    total_prescritores: number
    receita_total: number
  }
  por_representante: Array<{ representante: string; total_visitas: number; realizadas: number; prescritores_visitados: number }>
  por_categoria: Record<string, number>
  cronograma: Array<{ data: string; status: string; categoria_prioridade: string; nome_canonico: string; cidade: string; bairro: string; representante: string; total_notas: number }>
  prescritores: Array<{ nome: string; categoria: string; classe_abc: string; valor_total: number; tendencia: string; roi_visita: number | null; foi_visitado: boolean }>
}

export default function Relatorio() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [repFiltro, setRepFiltro] = useState('')
  const [reps, setReps] = useState<Array<{ id: number; nome: string }>>([])
  const [data, setData] = useState<Relatorio | null>(null)
  const [loading, setLoading] = useState(false)
  const [secao, setSecao] = useState<'resumo' | 'cronograma' | 'prescritores'>('resumo')

  useEffect(() => {
    fetch('/api/representantes').then(r => r.json()).then(setReps)
  }, [])

  const [erro, setErro] = useState<string | null>(null)
  const carregar = async () => {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ mes: String(mes), ano: String(ano) })
      if (repFiltro) params.set('representante_id', repFiltro)
      const res = await fetch(`/api/relatorio?${params}`)
      const text = await res.text()
      const json = JSON.parse(text)
      if (json.error) setErro(json.error)
      else setData(json)
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [mes, ano, repFiltro])

  const exportarCSV = () => {
    if (!data) return
    const linhas = [
      'Prescritor,Categoria,Classe,Valor Total,Tendência,ROI/Visita,Visitado',
      ...data.prescritores.map(p =>
        `"${p.nome}",${p.categoria},${p.classe_abc},${p.valor_total},${p.tendencia},${p.roi_visita?.toFixed(0) ?? ''},${p.foi_visitado ? 'Sim' : 'Não'}`
      )
    ]
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `relatorio_${mes}_${ano}.csv`; a.click()
  }

  const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }
  const SELECT: React.CSSProperties = { border: '1px solid #E8E8E8', background: '#fff', color: '#1A1A2E', borderRadius: 8, padding: '6px 12px', fontSize: 14 }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Relatório</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Análise completa por período</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} style={SELECT}>
            {MESES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} style={{ ...SELECT, width: 80 }} />
          <select value={repFiltro} onChange={e => setRepFiltro(e.target.value)} style={SELECT}>
            <option value="">Todos os reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button onClick={exportarCSV} disabled={!data}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
            style={{ border: '1px solid #E8E8E8', color: '#6B7280', background: '#fff' }}
          >
            <Download size={14} /> CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors"
            style={{ border: '1px solid #E8E8E8', color: '#6B7280', background: '#fff' }}
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {erro && !loading && (
        <div className="p-4 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
          Erro ao carregar relatório: {erro}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32 gap-2" style={{ color: '#009EE2' }}>
          <RefreshCw size={18} className="animate-spin" /> <span style={{ color: '#6B7280' }}>Carregando...</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Prescritores', value: data.resumo.total_prescritores, icon: <Users size={16} />, color: '#2C4A9A' },
              { label: 'Receita total', value: fmt(data.resumo.receita_total), icon: <TrendingUp size={16} />, color: '#88A201' },
              { label: 'Visitas importadas', value: data.resumo.total_visitas_importadas, icon: <BarChart3 size={16} />, color: '#009EE2' },
              { label: 'No cronograma', value: data.resumo.total_cronograma, icon: <BarChart3 size={16} />, color: '#6B7280' },
              { label: 'Realizadas', value: data.resumo.realizadas_cronograma, icon: <CheckCircle size={16} />, color: '#88A201' },
              { label: 'Taxa execução', value: `${data.resumo.taxa_execucao}%`, icon: <CheckCircle size={16} />, color: data.resumo.taxa_execucao >= '70' ? '#88A201' : '#CC1111' },
            ].map(kpi => (
              <div key={kpi.label} style={CARD} className="p-3">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: kpi.color }}>
                  {kpi.icon}
                  <span className="text-xs font-medium">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: '#1A1A2E' }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid #E8E8E8' }} className="flex gap-1">
            {([
              { key: 'resumo', label: 'Resumo' },
              { key: 'cronograma', label: `Cronograma (${data.resumo.total_cronograma})` },
              { key: 'prescritores', label: `Carteira (${data.resumo.total_prescritores})` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setSecao(t.key)}
                className="px-4 py-2.5 text-sm font-medium transition-colors"
                style={secao === t.key ? { borderBottom: '2px solid #009EE2', color: '#009EE2', marginBottom: -1 } : { color: '#9CA3AF' }}
              >{t.label}</button>
            ))}
          </div>

          {/* Resumo */}
          {secao === 'resumo' && (
            <div className="space-y-4">
              {/* Por representante */}
              {data.por_representante.length > 0 && (
                <div style={CARD} className="overflow-x-auto">
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <h3 className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>Por representante</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                        {['Representante', 'Visitas importadas', 'Realizadas', 'Prescritores visitados'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#9CA3AF' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_representante.map(r => (
                        <tr key={r.representante} style={{ borderBottom: '1px solid #F9FAFB' }}>
                          <td className="px-4 py-2.5 font-medium" style={{ color: '#1A1A2E' }}>{r.representante}</td>
                          <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{r.total_visitas}</td>
                          <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{r.realizadas}</td>
                          <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{r.prescritores_visitados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Por categoria */}
              <div style={CARD} className="p-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#1A1A2E' }}>Carteira por categoria</h3>
                <div className="space-y-2">
                  {Object.entries(data.por_categoria).filter(([, n]) => n > 0).map(([cat, n]) => {
                    const total = Object.values(data.por_categoria).reduce((a, b) => a + b, 0)
                    const pct = total > 0 ? (n / total) * 100 : 0
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: CAT_COLOR[cat] ?? '#6B7280' }}>{CAT_LABEL[cat] ?? cat}</span>
                          <span style={{ color: '#6B7280' }}>{n} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F0F0' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CAT_COLOR[cat] ?? '#6B7280' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cronograma */}
          {secao === 'cronograma' && (
            <div style={CARD} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                    {['Data', 'Prescritor', 'Representante', 'Categoria', 'Local', 'Notas', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#9CA3AF' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cronograma.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB', opacity: c.status === 'cancelada' ? 0.5 : 1 }}>
                      <td className="px-4 py-2 text-xs" style={{ color: '#6B7280' }}>{c.data}</td>
                      <td className="px-4 py-2 font-medium text-xs" style={{ color: '#1A1A2E' }}>{c.nome_canonico}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#6B7280' }}>{c.representante}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-medium" style={{ color: CAT_COLOR[c.categoria_prioridade] ?? '#6B7280' }}>
                          {CAT_LABEL[c.categoria_prioridade] ?? c.categoria_prioridade}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#9CA3AF' }}>{[c.bairro, c.cidade].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: c.total_notas > 0 ? '#2C4A9A' : '#D1D5DB' }}>{c.total_notas > 0 ? `📋 ${c.total_notas}` : '—'}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={c.status === 'realizada' ? { background: '#EEF5D6', color: '#4A7000' }
                            : c.status === 'cancelada' ? { background: '#FEE8E8', color: '#CC1111' }
                            : { background: '#F5F7FA', color: '#9CA3AF' }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Prescritores */}
          {secao === 'prescritores' && (
            <div style={CARD} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                    {['Prescritor', 'Categoria', 'Classe', 'Receita', 'Tendência', 'ROI/Visita', 'Visitado'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#9CA3AF' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.prescritores.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td className="px-4 py-2 font-medium text-xs" style={{ color: '#1A1A2E' }}>{p.nome}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-medium" style={{ color: CAT_COLOR[p.categoria] ?? '#6B7280' }}>
                          {CAT_LABEL[p.categoria] ?? p.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={p.classe_abc === 'A' ? { background: '#FFF8CC', color: '#A07C00' }
                            : p.classe_abc === 'B' ? { background: '#EAF0FF', color: '#2C4A9A' }
                            : { background: '#F5F7FA', color: '#9CA3AF' }}>
                          {p.classe_abc}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs font-medium" style={{ color: '#1A1A2E' }}>{fmt(p.valor_total)}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: p.tendencia?.includes('queda') ? '#CC1111' : p.tendencia?.includes('alta') ? '#4A7000' : '#6B7280' }}>
                        {p.tendencia?.replace('_', ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#6B7280' }}>{p.roi_visita != null ? fmt(p.roi_visita) : '—'}</td>
                      <td className="px-4 py-2 text-xs">{p.foi_visitado ? <span style={{ color: '#4A7000' }}>✓ Sim</span> : <span style={{ color: '#D1D5DB' }}>Não</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
