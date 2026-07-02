'use client'
import { useState, useEffect, useCallback } from 'react'
import { Calendar, Play, CheckCircle, XCircle, Clock, RotateCcw, RefreshCw } from 'lucide-react'

const MESES_NOMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const CAT_COLORS: Record<string, string> = {
  top_roi: 'bg-yellow-900/60 border-yellow-700/50 text-yellow-200',
  crescimento: 'bg-green-900/60 border-green-700/50 text-green-200',
  reativacao: 'bg-orange-900/60 border-orange-700/50 text-orange-200',
  risco: 'bg-red-900/60 border-red-700/50 text-red-200',
  ativo_medio: 'bg-blue-900/60 border-blue-700/50 text-blue-200',
  ativo_regular: 'bg-sky-900/60 border-sky-700/50 text-sky-200',
  pontual: 'bg-gray-800 border-gray-700 text-gray-300',
  sem_venda: 'bg-gray-900 border-gray-800 text-gray-500',
}

interface VisitaCronograma {
  id: number; data: string; status: string; categoria_prioridade: string
  prescritor_nome: string; tipo_entidade: string; representante_nome: string; territorio: string
}
interface Representante { id: number; nome: string; territorio: string }

export default function Cronograma() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [repFiltro, setRepFiltro] = useState('')
  const [visitas, setVisitas] = useState<VisitaCronograma[]>([])
  const [reps, setReps] = useState<Representante[]>([])
  const [gerando, setGerando] = useState(false)
  const [loading, setLoading] = useState(false)

  const carregarVisitas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ mes: String(mes), ano: String(ano) })
    if (repFiltro) params.set('representante_id', repFiltro)
    const v = await fetch(`/api/cronograma?${params}`).then(r => r.json())
    setVisitas(v)
    setLoading(false)
  }, [mes, ano, repFiltro])

  useEffect(() => {
    fetch('/api/representantes').then(r => r.json()).then(setReps)
  }, [])

  useEffect(() => { carregarVisitas() }, [carregarVisitas])

  const gerarCronograma = async () => {
    setGerando(true)
    await fetch('/api/cronograma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano }),
    })
    setGerando(false)
    carregarVisitas()
  }

  const atualizarStatus = async (id: number, status: string) => {
    await fetch('/api/cronograma', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setVisitas(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  // Agrupar por semana e dia
  const diasDoMes: Array<{ data: string; dow: number; visitas: VisitaCronograma[] }> = []
  const seen = new Set<string>()
  for (const v of visitas) {
    if (!seen.has(v.data)) {
      seen.add(v.data)
      const d = new Date(v.data + 'T12:00:00')
      diasDoMes.push({ data: v.data, dow: d.getDay(), visitas: [] })
    }
  }
  diasDoMes.sort((a, b) => a.data.localeCompare(b.data))
  for (const dia of diasDoMes) {
    dia.visitas = visitas.filter(v => v.data === dia.data)
  }

  // Progresso
  const total = visitas.length
  const realizadas = visitas.filter(v => v.status === 'realizada').length
  const progresso = total > 0 ? (realizadas / total) * 100 : 0

  // Exportar CSV
  const exportarCSV = () => {
    const headers = 'Data,Representante,Prescritor,Categoria,Status'
    const rows = visitas.map(v => `${v.data},${v.representante_nome},${v.prescritor_nome},${v.categoria_prioridade},${v.status}`)
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cronograma_${mes}_${ano}.csv`; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cronograma de Visitas</h1>
          <p className="text-gray-400 text-sm mt-1">{MESES_NOMES[mes]} {ano}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
            {MESES_NOMES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 w-20" />
          <select value={repFiltro} onChange={e => setRepFiltro(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
            <option value="">Todos os representantes</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button onClick={gerarCronograma} disabled={gerando} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition">
            {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {gerando ? 'Gerando...' : 'Gerar Cronograma'}
          </button>
          <button onClick={exportarCSV} className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition">Exportar CSV</button>
        </div>
      </div>

      {/* Progresso */}
      {total > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progresso do mês</span>
            <span className="text-white">{realizadas}/{total} visitas ({progresso.toFixed(0)}%)</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CAT_COLORS).map(([cat, cls]) => (
          <span key={cat} className={`text-xs px-2 py-1 rounded border ${cls}`}>
            {cat.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Dias */}
      {loading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-gray-500"><RefreshCw size={18} className="animate-spin" /> Carregando...</div>
      ) : diasDoMes.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-600">
          <Calendar size={40} className="mx-auto mb-3 text-gray-700" />
          Nenhum cronograma gerado. Clique em <strong className="text-gray-500">Gerar Cronograma</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          {diasDoMes.map(({ data, dow, visitas: vs }) => {
            const [, , dd] = data.split('-')
            return (
              <div key={data} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-800/50 border-b border-gray-800 flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono">{DIAS[dow]}</span>
                  <span className="text-white font-medium">{dd}/{String(mes).padStart(2,'0')}/{ano}</span>
                  <span className="text-xs text-gray-500">{vs.length} visitas</span>
                </div>
                <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {vs.map(v => (
                    <div key={v.id} className={`rounded-lg border p-2.5 ${CAT_COLORS[v.categoria_prioridade] ?? CAT_COLORS.pontual} ${v.status === 'realizada' ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{v.prescritor_nome}</p>
                          <p className="text-xs opacity-70 mt-0.5">{v.representante_nome}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => atualizarStatus(v.id, 'realizada')} title="Realizada" className="hover:opacity-100 opacity-60">
                            <CheckCircle size={14} className={v.status === 'realizada' ? 'text-green-400' : ''} />
                          </button>
                          <button onClick={() => atualizarStatus(v.id, 'cancelada')} title="Cancelada" className="hover:opacity-100 opacity-60">
                            <XCircle size={14} className={v.status === 'cancelada' ? 'text-red-400' : ''} />
                          </button>
                          <button onClick={() => atualizarStatus(v.id, 'pendente')} title="Resetar" className="hover:opacity-100 opacity-60">
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      </div>
                      <span className="text-xs opacity-60 mt-1 block">{v.categoria_prioridade.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
