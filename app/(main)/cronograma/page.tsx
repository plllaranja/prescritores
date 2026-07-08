'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, Play, CheckCircle, XCircle, RotateCcw, RefreshCw, ClipboardList, ChevronRight, X, Send, Trash2, Map, Settings2 } from 'lucide-react'

const MESES_NOMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }

const CAT_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  top_roi:      { bg: '#FFF8CC', color: '#A07C00', border: '#F0D800' },
  crescimento:  { bg: '#EEF5D6', color: '#4A7000', border: '#B8D96E' },
  reativacao:   { bg: '#FFF0E0', color: '#CC5500', border: '#FFBB80' },
  risco:        { bg: '#FEE8E8', color: '#CC1111', border: '#FECACA' },
  ativo_medio:  { bg: '#E7F8FF', color: '#007AB8', border: '#80DDFF' },
  ativo_regular:{ bg: '#EAF0FF', color: '#2C4A9A', border: '#ADC0F0' },
  pontual:      { bg: '#F5F7FA', color: '#6B7280', border: '#E8E8E8' },
  sem_venda:    { bg: '#FAFAFA', color: '#9CA3AF', border: '#F0F0F0' },
}

interface VisitaCronograma {
  id: number; data: string; status: string; categoria_prioridade: string
  prescritor_id: number; prescritor_nome: string; tipo_entidade: string
  representante_id: number; representante_nome: string; territorio: string
  cidade: string | null; bairro: string | null; logradouro: string | null; total_notas: number
}
interface Representante { id: number; nome: string; territorio: string; visitas_por_dia: number }
interface Nota {
  id: number; data: string; conteudo: string; criado_em: string
  representante_nome: string | null; categoria_prioridade: string | null
}

// Painel lateral de registro de visita + memória do prescritor
function PainelVisita({
  visita, onClose, onSalvo,
}: {
  visita: VisitaCronograma
  onClose: () => void
  onSalvo: (visitaId: number) => void
}) {
  const [notas, setNotas] = useState<Nota[]>([])
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/notas?prescritor_id=${visita.prescritor_id}`)
      .then(r => r.json()).then(setNotas)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [visita.prescritor_id])

  const salvar = async () => {
    if (!texto.trim()) return
    setSalvando(true)
    await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prescritor_id: visita.prescritor_id,
        visita_id: visita.id,
        representante_id: visita.representante_id,
        conteudo: texto,
        data: visita.data,
      }),
    })
    onSalvo(visita.id)
    setTexto('')
    // Recarrega notas sem fechar o painel
    fetch(`/api/notas?prescritor_id=${visita.prescritor_id}`)
      .then(r => r.json()).then(setNotas)
    setSalvando(false)
  }

  const excluirNota = async (id: number) => {
    await fetch('/api/notas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const s = CAT_STYLE[visita.categoria_prioridade] ?? CAT_STYLE.pontual

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      {/* Painel */}
      <div
        className="lf-visita-panel fixed right-0 top-0 h-screen z-50 flex flex-col"
        style={{ width: 420, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid #F0F0F0' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>
                {visita.categoria_prioridade?.replace('_', ' ')}
              </span>
              {(visita.logradouro || visita.bairro || visita.cidade) && (
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent([visita.logradouro, visita.bairro, visita.cidade].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 hover:underline"
                  style={{ color: '#009EE2' }}
                  onClick={e => e.stopPropagation()}
                >
                  📍 {[visita.logradouro, visita.bairro, visita.cidade].filter(Boolean).join(', ')}
                </a>
              )}
            </div>
            <h2 className="font-bold text-base leading-tight" style={{ color: '#1A1A2E' }}>{visita.prescritor_nome}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{visita.representante_nome} · {visita.data}</p>
          </div>
          <button onClick={onClose} className="ml-3 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: '#9CA3AF' }} />
          </button>
        </div>

        {/* Área de nova nota */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0F0F0' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#2C4A9A' }}>Como foi a visita?</p>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) salvar() }}
            placeholder="Ex: Demonstrou interesse em Ômega 3. Pediu material sobre vitamina D. Próxima visita em 2 semanas..."
            rows={4}
            className="w-full text-sm resize-none rounded-lg px-3 py-2.5 focus:outline-none"
            style={{ border: '1px solid #E8E8E8', background: '#F9FAFB', color: '#1A1A2E' }}
          />
          <div className="flex items-start sm:items-center justify-between gap-2 mt-2 flex-col sm:flex-row">
            <p className="text-xs" style={{ color: '#C0C0C0' }}>Ctrl+Enter para salvar</p>
            <button
              onClick={salvar}
              disabled={!texto.trim() || salvando}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: '#88A201', color: '#fff' }}
            >
              {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Registrar visita
            </button>
          </div>
        </div>

        {/* Histórico / Memória */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold mb-3" style={{ color: '#9CA3AF' }}>
            HISTÓRICO ({notas.length} {notas.length === 1 ? 'nota' : 'notas'})
          </p>
          {notas.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList size={32} className="mx-auto mb-2" style={{ color: '#E8E8E8' }} />
              <p className="text-sm" style={{ color: '#C0C0C0' }}>Nenhuma nota anterior.</p>
              <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>Esta será a primeira!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notas.map(n => (
                <div key={n.id} className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F0F0F0' }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <span className="text-xs font-semibold" style={{ color: '#2C4A9A' }}>{n.data}</span>
                      {n.representante_nome && (
                        <span className="text-xs ml-2" style={{ color: '#9CA3AF' }}>· {n.representante_nome}</span>
                      )}
                    </div>
                    <button onClick={() => excluirNota(n.id)} className="opacity-30 hover:opacity-70 transition-opacity flex-shrink-0">
                      <Trash2 size={12} style={{ color: '#CC1111' }} />
                    </button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#374151' }}>{n.conteudo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function Cronograma() {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const [viewTab, setViewTab] = useState<'hoje' | 'mes'>('hoje')
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [repFiltro, setRepFiltro] = useState('')
  const [visitas, setVisitas] = useState<VisitaCronograma[]>([])
  const [reps, setReps] = useState<Representante[]>([])
  const [gerando, setGerando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [painelVisita, setPainelVisita] = useState<VisitaCronograma | null>(null)
  const [modalGerar, setModalGerar] = useState(false)
  const [modalConfirmar, setModalConfirmar] = useState(false)
  // Configurações de geração
  const [diasVisita, setDiasVisita] = useState<number[]>([1, 2, 3, 4, 5])
  const [visitasPorDia, setVisitasPorDia] = useState<number | ''>('')
  const [geradoMsg, setGeradoMsg] = useState('')
  const [repsSelec, setRepsSelec] = useState<number[]>([])  // vazio = todos
  const [modoGeracao, setModoGeracao] = useState<'distribuir' | 'carteira'>('distribuir')
  const [vpdPorRep, setVpdPorRep] = useState<Record<number, number>>({})
  const [resultadoPorRep, setResultadoPorRep] = useState<Array<{ nome: string; cnt: number }>>([])

  // Inicializar seleção quando reps carregam
  useEffect(() => { if (reps.length > 0 && repsSelec.length === 0) setRepsSelec(reps.map(r => r.id)) }, [reps])

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
    setModalGerar(false)
    const configReps = Object.entries(vpdPorRep).map(([id, vpd]) => ({ rep_id: Number(id), visitas_por_dia: vpd }))
    const res = await fetch('/api/cronograma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mes, ano,
        dias_visita: diasVisita,
        visitas_por_dia_override: visitasPorDia !== '' ? Number(visitasPorDia) : undefined,
        representante_ids: repsSelec,
        modo: modoGeracao,
        config_reps: configReps,
      }),
    })
    const json = await res.json()
    setResultadoPorRep(json.por_rep ?? [])
    setGeradoMsg(`✓ ${json.visitas_geradas} visitas geradas`)
    setTimeout(() => setGeradoMsg(''), 6000)
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

  const SELECT_STYLE: React.CSSProperties = { border: '1px solid #E8E8E8', background: '#fff', color: '#1A1A2E', borderRadius: 8, padding: '6px 12px', fontSize: 14 }

  const visitasHoje = visitas.filter(v => v.data === hojeStr)
  const hoje_pendentes = visitasHoje.filter(v => v.status === 'pendente').length
  const hoje_realizadas = visitasHoje.filter(v => v.status === 'realizada').length

  return (
    <div className="space-y-6">
      {painelVisita && (
        <PainelVisita
          visita={painelVisita}
          onClose={() => setPainelVisita(null)}
          onSalvo={(id) => setVisitas(prev => prev.map(v => v.id === id ? { ...v, status: 'realizada', total_notas: v.total_notas + 1 } : v))}
        />
      )}

      {/* Modal de confirmação: substituir cronograma existente */}
      {modalConfirmar && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={() => setModalConfirmar(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#1A1A2E' }}>Gerar novo cronograma?</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                    Já existe um cronograma para <strong>{MESES_NOMES[mes]}/{ano}</strong> com {visitas.length} visitas.
                    Isso irá apagar o anterior.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModalConfirmar(false)}
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ border: '1px solid #E8E8E8', color: '#6B7280' }}>
                  Cancelar
                </button>
                <button
                  onClick={() => { setModalConfirmar(false); setModalGerar(true) }}
                  className="text-sm font-medium px-5 py-2 rounded-lg"
                  style={{ background: '#CC5500', color: '#fff' }}>
                  Sim, substituir
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de configuração de geração */}
      {modalGerar && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={() => setModalGerar(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]" style={{ background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base" style={{ color: '#1A1A2E' }}>Configurar cronograma — {MESES_NOMES[mes]}/{ano}</h2>
                <button onClick={() => setModalGerar(false)}><X size={18} style={{ color: '#9CA3AF' }} /></button>
              </div>

              {/* Representantes */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#2C4A9A' }}>Representantes que receberão visitas</p>
                <div className="space-y-2">
                  {reps.map(r => {
                    const selecionado = repsSelec.includes(r.id)
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ border: `1px solid ${selecionado ? '#2C4A9A' : '#E8E8E8'}`, background: selecionado ? '#EAF0FF' : '#FAFAFA' }}>
                        <input type="checkbox" checked={selecionado}
                          onChange={() => setRepsSelec(prev => selecionado ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                          style={{ width: 16, height: 16, accentColor: '#2C4A9A' }} />
                        <div className="flex-1">
                          <span className="text-sm font-medium" style={{ color: '#1A1A2E' }}>{r.nome}</span>
                          {r.territorio && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#F5F7FA', color: '#6B7280' }}>{r.territorio}</span>}
                        </div>
                        {selecionado && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: '#6B7280' }}>vis/dia:</span>
                            <input type="number" min={1} max={20} placeholder={String(r.visitas_por_dia ?? 6)}
                              value={vpdPorRep[r.id] ?? ''}
                              onChange={e => setVpdPorRep(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
                              className="focus:outline-none text-center text-sm font-medium"
                              style={{ width: 48, border: '1px solid #E8E8E8', borderRadius: 6, padding: '2px 4px', background: '#fff' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setRepsSelec(reps.map(r => r.id))} className="text-xs px-2 py-1 rounded" style={{ color: '#2C4A9A', background: '#EAF0FF' }}>Todos</button>
                  <button onClick={() => setRepsSelec([])} className="text-xs px-2 py-1 rounded" style={{ color: '#6B7280', background: '#F5F7FA' }}>Nenhum</button>
                </div>
              </div>

              {/* Modo de distribuição */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#2C4A9A' }}>Distribuição de prescritores</p>
                <div className="flex gap-2">
                  {([
                    { value: 'distribuir', label: 'Distribuir entre as reps', desc: 'Divide o pool por cidade/território entre as reps selecionadas' },
                    { value: 'carteira', label: 'Carteira histórica', desc: 'Cada rep recebe os prescritores que já visitou antes' },
                  ] as const).map(opt => (
                    <button key={opt.value} onClick={() => setModoGeracao(opt.value)}
                      className="flex-1 text-left p-3 rounded-xl text-xs"
                      style={{ border: `2px solid ${modoGeracao === opt.value ? '#2C4A9A' : '#E8E8E8'}`, background: modoGeracao === opt.value ? '#EAF0FF' : '#FAFAFA' }}>
                      <p className="font-semibold mb-1" style={{ color: modoGeracao === opt.value ? '#2C4A9A' : '#1A1A2E' }}>{opt.label}</p>
                      <p style={{ color: '#6B7280' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dias de visita */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#2C4A9A' }}>Dias de visita</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { dow: 1, label: 'Seg' }, { dow: 2, label: 'Ter' }, { dow: 3, label: 'Qua' },
                    { dow: 4, label: 'Qui' }, { dow: 5, label: 'Sex' }, { dow: 6, label: 'Sáb' },
                  ].map(({ dow, label }) => {
                    const ativo = diasVisita.includes(dow)
                    return (
                      <button key={dow}
                        onClick={() => setDiasVisita(prev => ativo ? prev.filter(d => d !== dow) : [...prev, dow].sort())}
                        className="w-12 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={ativo ? { background: '#2C4A9A', color: '#fff' } : { background: '#F5F7FA', color: '#9CA3AF', border: '1px solid #E8E8E8' }}
                      >{label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Visitas por dia (global override) */}
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#2C4A9A' }}>
                  Visitas/dia global <span className="font-normal" style={{ color: '#9CA3AF' }}>(sobrescreve o individual acima)</span>
                </p>
                <div className="flex items-center gap-3">
                  <input type="number" value={visitasPorDia}
                    onChange={e => setVisitasPorDia(e.target.value === '' ? '' : Number(e.target.value))}
                    min={1} max={30} placeholder="individual por rep"
                    className="focus:outline-none w-32"
                    style={{ border: '1px solid #E8E8E8', background: '#F9FAFB', color: '#1A1A2E', borderRadius: 8, padding: '8px 12px', fontSize: 14 }} />
                  <div className="flex gap-1.5">
                    {[4, 6, 8, 10].map(n => (
                      <button key={n} onClick={() => setVisitasPorDia(n)}
                        className="w-9 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={visitasPorDia === n ? { background: '#FFCB00', color: '#2C4A9A' } : { background: '#F5F7FA', color: '#6B7280', border: '1px solid #E8E8E8' }}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setModalGerar(false)} className="text-sm px-4 py-2 rounded-lg" style={{ border: '1px solid #E8E8E8', color: '#6B7280' }}>
                  Cancelar
                </button>
                <button onClick={gerarCronograma} disabled={diasVisita.length === 0 || repsSelec.length === 0}
                  className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-40"
                  style={{ background: '#009EE2', color: '#fff' }}>
                  <Play size={14} /> Gerar para {repsSelec.length} rep{repsSelec.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Cronograma de Visitas</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{MESES_NOMES[mes]} {ano}</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full lg:w-auto">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} style={SELECT_STYLE}>
            {MESES_NOMES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} style={{ ...SELECT_STYLE, width: 80 }} />
          <select value={repFiltro} onChange={e => setRepFiltro(e.target.value)} style={SELECT_STYLE}>
            <option value="">Todos os representantes</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button
            onClick={() => visitas.length > 0 ? setModalConfirmar(true) : setModalGerar(true)}
            disabled={gerando}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: '#009EE2', color: '#fff' }}
          >
            {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Settings2 size={14} />}
            {gerando ? 'Gerando...' : 'Gerar Cronograma'}
          </button>
          {geradoMsg && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium" style={{ color: '#88A201' }}>{geradoMsg}</span>
              {resultadoPorRep.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {resultadoPorRep.map(r => (
                    <span key={r.nome} className="text-xs px-2 py-0.5 rounded" style={{ background: '#EAF0FF', color: '#2C4A9A' }}>
                      {r.nome.split(' ')[0]}: {r.cnt}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={exportarCSV}
            className="text-sm px-3 py-2 rounded-lg transition-colors hover:bg-white flex-1 sm:flex-none"
            style={{ border: '1px solid #E8E8E8', color: '#6B7280', background: '#fff' }}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Progresso */}
      {total > 0 && (
        <div style={CARD} className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: '#6B7280' }}>Progresso do mês</span>
            <span className="font-medium" style={{ color: '#1A1A2E' }}>{realizadas}/{total} visitas ({progresso.toFixed(0)}%)</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F0F0F0' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progresso}%`, background: '#88A201' }} />
          </div>
        </div>
      )}

      {/* Tabs Hoje / Mês */}
      <div style={{ borderBottom: '1px solid #E8E8E8' }} className="flex gap-1">
        <button
          onClick={() => setViewTab('hoje')}
          className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
          style={viewTab === 'hoje' ? { borderBottom: '2px solid #009EE2', color: '#009EE2', marginBottom: -1 } : { color: '#9CA3AF' }}
        >
          <ClipboardList size={15} />
          Hoje
          {visitasHoje.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: hoje_pendentes > 0 ? '#009EE2' : '#88A201', color: '#fff' }}>
              {hoje_realizadas}/{visitasHoje.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewTab('mes')}
          className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
          style={viewTab === 'mes' ? { borderBottom: '2px solid #009EE2', color: '#009EE2', marginBottom: -1 } : { color: '#9CA3AF' }}
        >
          <Calendar size={15} /> Visão mensal
        </button>
      </div>

      {/* ABA HOJE — Checklist */}
      {viewTab === 'hoje' && (
        <div className="space-y-3">
          {/* Botão de rota Google Maps */}
          {visitasHoje.length > 0 && (
            (() => {
              const enderecos = visitasHoje
                .filter(v => v.logradouro || v.bairro || v.cidade)
                .map(v => [v.logradouro, v.bairro, v.cidade].filter(Boolean).join(', '))
              if (enderecos.length < 2) return null
              const url = `https://www.google.com/maps/dir/${enderecos.map(encodeURIComponent).join('/')}`
              return (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl w-fit transition-colors"
                  style={{ background: '#E7F8FF', color: '#009EE2', border: '1px solid #80DDFF' }}
                >
                  <Map size={15} /> Ver rota do dia no Google Maps ({enderecos.length} paradas)
                </a>
              )
            })()
          )}
          {visitasHoje.length === 0 ? (
            <div style={CARD} className="p-6 sm:p-12 text-center">
              <ClipboardList size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p style={{ color: '#9CA3AF' }}>Nenhuma visita programada para hoje.</p>
              {diasDoMes.length === 0 && (
                <p className="text-sm mt-1" style={{ color: '#D1D5DB' }}>Gere um cronograma primeiro na aba "Visão mensal".</p>
              )}
            </div>
          ) : (
            visitasHoje.map(v => {
              const s = CAT_STYLE[v.categoria_prioridade] ?? CAT_STYLE.pontual
              const realizada = v.status === 'realizada'
              return (
                <div
                  key={v.id}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-3.5 transition-all cursor-pointer"
                  style={{
                    background: '#fff',
                    border: realizada ? '1px solid #C6E6A0' : '1px solid #E8E8E8',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    opacity: realizada ? 0.75 : 1,
                  }}
                  onClick={() => setPainelVisita(v)}
                >
                  {/* Check button */}
                  <button
                    onClick={e => { e.stopPropagation(); setPainelVisita(v) }}
                    className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={realizada
                      ? { borderColor: '#88A201', background: '#88A201' }
                      : { borderColor: '#D1D5DB', background: '#fff' }}
                  >
                    {realizada && <CheckCircle size={16} color="#fff" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center gap-2 mb-0.5 flex-col sm:flex-row">
                      <span className="font-semibold text-sm truncate" style={{ color: realizada ? '#9CA3AF' : '#1A1A2E', textDecoration: realizada ? 'line-through' : 'none' }}>
                        {v.prescritor_nome}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>
                        {v.categoria_prioridade?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-start sm:items-center gap-1 sm:gap-3 text-xs flex-col sm:flex-row" style={{ color: '#9CA3AF' }}>
                      <span>{v.representante_nome}</span>
                      {(v.bairro || v.cidade) && <span>📍 {[v.bairro, v.cidade].filter(Boolean).join(', ')}</span>}
                      {v.total_notas > 0 && (
                        <span style={{ color: '#2C4A9A' }}>📋 {v.total_notas} {v.total_notas === 1 ? 'nota' : 'notas'}</span>
                      )}
                    </div>
                  </div>

                  {/* Ação */}
                  {realizada ? (
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#88A201' }}>✓ Realizada</span>
                  ) : (
                    <ChevronRight size={18} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ABA MÊS — Legenda + dias */}
      {viewTab === 'mes' && <>
      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CAT_STYLE).map(([cat, s]) => (
          <span key={cat} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            {cat.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Dias */}
      {loading ? (
        <div className="flex items-center justify-center h-32 gap-2" style={{ color: '#009EE2' }}>
          <RefreshCw size={18} className="animate-spin" /> <span style={{ color: '#6B7280' }}>Carregando...</span>
        </div>
      ) : diasDoMes.length === 0 ? (
        <div style={CARD} className="p-6 sm:p-12 text-center">
          <Calendar size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p style={{ color: '#9CA3AF' }}>Nenhum cronograma gerado. Clique em <strong style={{ color: '#2C4A9A' }}>Gerar Cronograma</strong>.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diasDoMes.map(({ data, dow, visitas: vs }) => {
            const [, , dd] = data.split('-')
            return (
              <div key={data} style={CARD} className="overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                  <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{DIAS[dow]}</span>
                  <span className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{dd}/{String(mes).padStart(2,'0')}/{ano}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E7F8FF', color: '#007AB8' }}>{vs.length} visitas</span>
                </div>
                <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {vs.map(v => {
                    const s = CAT_STYLE[v.categoria_prioridade] ?? CAT_STYLE.pontual
                    return (
                      <div
                        key={v.id}
                        className="rounded-lg p-2.5 transition-opacity"
                        style={{ background: s.bg, border: `1px solid ${s.border}`, opacity: v.status === 'realizada' ? 0.55 : 1 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: s.color }}>{v.prescritor_nome}</p>
                            <p className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{v.representante_nome}</p>
                            {(v.bairro || v.cidade) && (
                              <p className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.5 }}>
                                📍 {[v.bairro, v.cidade].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => atualizarStatus(v.id, 'realizada')} title="Realizada" className="opacity-60 hover:opacity-100 transition-opacity">
                              <CheckCircle size={14} style={{ color: v.status === 'realizada' ? '#88A201' : s.color }} />
                            </button>
                            <button onClick={() => atualizarStatus(v.id, 'cancelada')} title="Cancelada" className="opacity-60 hover:opacity-100 transition-opacity">
                              <XCircle size={14} style={{ color: v.status === 'cancelada' ? '#CC1111' : s.color }} />
                            </button>
                            <button onClick={() => atualizarStatus(v.id, 'pendente')} title="Resetar" className="opacity-60 hover:opacity-100 transition-opacity">
                              <RotateCcw size={12} style={{ color: s.color }} />
                            </button>
                          </div>
                        </div>
                        <span className="text-xs mt-1 block" style={{ color: s.color, opacity: 0.6 }}>{v.categoria_prioridade.replace('_', ' ')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>}
    </div>
  )
}
