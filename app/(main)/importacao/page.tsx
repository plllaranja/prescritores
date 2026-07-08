'use client'
import { useState, useRef, useCallback } from 'react'
import { UploadCloud, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw, Download } from 'lucide-react'

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }

interface RelatorioItem {
  arquivo: string; tipo: string; mes?: number; ano?: number
  linhas: number; ignoradas: number; erros: number; status: string; mensagem?: string
}
interface MatchPendente {
  id: number; nome_visita: string; nome_candidato: string; score: number
}
const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function Importacao() {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioItem[] | null>(null)
  const [matches, setMatches] = useState<MatchPendente[]>([])
  const [historico, setHistorico] = useState<unknown[]>([])
  const [tab, setTab] = useState<'upload' | 'revisao' | 'historico'>('upload')
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xlsx'))
    setFiles(prev => [...prev, ...dropped])
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleUpload = async () => {
    if (!files.length) return
    setLoading(true)
    const form = new FormData()
    for (const f of files) form.append('files', f)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = await res.json()
    setRelatorio(json.relatorio)
    setFiles([])
    setLoading(false)
    // Carregar matches pendentes
    const m = await fetch('/api/matches').then(r => r.json())
    if (m.length > 0) { setMatches(m); setTab('revisao') }
  }

  const carregarHistorico = async () => {
    const h = await fetch('/api/upload/historico').then(r => r.json())
    setHistorico(h); setTab('historico')
  }

  const resolverMatch = async (id: number, acao: string, prescId?: number) => {
    await fetch('/api/matches', { method: 'POST', body: JSON.stringify({ id, acao, prescritor_id: prescId }), headers: { 'Content-Type': 'application/json' } })
    setMatches(prev => prev.filter(m => m.id !== id))
  }

  const [reprocessando, setReprocessando] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<{ confirmados_pendentes: number; novos_links: number; ainda_sem_link: number } | null>(null)
  const reprocessarLinks = async () => {
    setReprocessando(true)
    setReprocessResult(null)
    const res = await fetch('/api/matches', { method: 'PUT' })
    const json = await res.json()
    setReprocessResult(json)
    setReprocessando(false)
    // Recarregar matches pendentes
    const m = await fetch('/api/matches').then(r => r.json())
    setMatches(m)
  }

  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle size={16} style={{ color: '#88A201' }} />
    if (status === 'erro') return <XCircle size={16} style={{ color: '#CC1111' }} />
    if (status === 'ja_existe') return <AlertCircle size={16} style={{ color: '#A07C00' }} />
    return <Clock size={16} style={{ color: '#9CA3AF' }} />
  }

  return (
    <div className="space-y-6 max-w-4xl w-full">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Importação de Dados</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Arraste arquivos .xlsx de vendas e visitas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={carregarHistorico}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white"
            style={{ color: '#6B7280', border: '1px solid #E8E8E8', background: '#fff' }}
          >
            <Clock size={14} /> Histórico
          </button>
          <a
            href="/api/backup"
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white"
            style={{ color: '#6B7280', border: '1px solid #E8E8E8', background: '#fff' }}
          >
            <Download size={14} /> Backup
          </a>
          <button
            onClick={reprocessarLinks}
            disabled={reprocessando}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
            style={{ color: '#fff', background: '#2C4A9A', border: 'none' }}
            title="Re-linka visitas com prescritores usando threshold mais baixo"
          >
            <RefreshCw size={14} className={reprocessando ? 'animate-spin' : ''} />
            {reprocessando ? 'Processando...' : 'Re-linkar Visitas'}
          </button>
        </div>
      </div>

      {reprocessResult && (
        <div className="p-3 rounded-lg text-sm flex gap-4" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
          <span>✓ <b>{reprocessResult.novos_links}</b> visitas linkadas</span>
          <span>✓ <b>{reprocessResult.confirmados_pendentes}</b> pendentes confirmados</span>
          {reprocessResult.ainda_sem_link > 0 && <span style={{ color: '#B45309' }}>⚠ <b>{reprocessResult.ainda_sem_link}</b> sem match (nomes muito diferentes)</span>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #E8E8E8' }} className="flex">
        {(['upload', 'revisao', 'historico'] as const).map(t => (
          <button
            key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={tab === t
              ? { borderBottom: '2px solid #009EE2', color: '#009EE2', marginBottom: -1 }
              : { color: '#9CA3AF' }}
          >
            {t === 'upload' ? 'Upload' : t === 'revisao' ? `Revisão${matches.length > 0 ? ` (${matches.length})` : ''}` : 'Histórico'}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer transition-colors"
            style={dragging
              ? { borderColor: '#009EE2', background: '#E7F8FF' }
              : { borderColor: '#E8E8E8', background: '#FAFAFA' }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#E7F8FF' }}>
              <UploadCloud size={28} style={{ color: '#009EE2' }} />
            </div>
            <p className="font-medium" style={{ color: '#1A1A2E' }}>Arraste os arquivos .xlsx aqui</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Ou clique para selecionar — aceita múltiplos arquivos de visitas e vendas</p>
            <input ref={inputRef} type="file" multiple accept=".xlsx" className="hidden" onChange={onFileChange} />
          </div>

          {/* Arquivos selecionados */}
          {files.length > 0 && (
            <div style={CARD} className="p-4 space-y-2">
              <p className="text-sm mb-3" style={{ color: '#9CA3AF' }}>Arquivos selecionados ({files.length}):</p>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: '#F5F7FA', border: '1px solid #E8E8E8' }}>
                  <span className="text-sm" style={{ color: '#1A1A2E' }}>{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-xs ml-4 hover:underline" style={{ color: '#CC1111' }}>remover</button>
                </div>
              ))}
              <button
                onClick={handleUpload} disabled={loading}
                className="w-full mt-3 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#009EE2', color: '#fff' }}
              >
                {loading ? <><RefreshCw size={16} className="animate-spin" /> Processando...</> : 'Confirmar e Importar'}
              </button>
            </div>
          )}

          {/* Relatório */}
          {relatorio && (
            <div style={CARD} className="p-4">
              <h3 className="font-semibold mb-3" style={{ color: '#1A1A2E' }}>Resultado da importação</h3>
              <div className="space-y-2">
                {relatorio.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: '#F9FAFB', border: '1px solid #F0F0F0' }}>
                    {statusIcon(r.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1A1A2E' }}>{r.arquivo}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                        {r.tipo} {r.mes ? `· ${MESES[r.mes]}/${r.ano}` : ''} · {r.linhas} linhas
                        {r.mensagem ? ` · ${r.mensagem}` : ''}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={
                      r.status === 'ok' ? { background: '#EEF5D6', color: '#4A7000' }
                      : r.status === 'erro' ? { background: '#FEE8E8', color: '#CC1111' }
                      : { background: '#FFF8CC', color: '#A07C00' }
                    }>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'revisao' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div style={CARD} className="p-10 text-center">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#88A201' }} />
              <p style={{ color: '#6B7280' }}>Nenhum match pendente de revisão.</p>
            </div>
          ) : (
            <div style={CARD} className="p-4">
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Esses matches têm score entre 70–84. Confirme ou rejeite cada um.
              </p>
              <div className="space-y-3">
                {matches.map(m => (
                  <div key={m.id} className="rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap" style={{ background: '#F9FAFB', border: '1px solid #E8E8E8' }}>
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>Visita</p>
                        <p className="text-sm font-medium" style={{ color: '#1A1A2E' }}>{m.nome_visita}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>Candidato (score: {m.score.toFixed(0)})</p>
                        <p className="text-sm font-medium" style={{ color: '#009EE2' }}>{m.nome_candidato}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resolverMatch(m.id, 'confirmar')} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: '#EEF5D6', color: '#4A7000' }}>Confirmar</button>
                      <button onClick={() => resolverMatch(m.id, 'rejeitar')} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: '#F5F7FA', color: '#6B7280', border: '1px solid #E8E8E8' }}>Rejeitar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div style={CARD} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                {['Arquivo', 'Tipo', 'Período', 'Data Upload', 'Linhas', 'Status'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium ${i >= 4 ? 'text-right' : 'text-left'}`} style={{ color: '#9CA3AF' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(historico as Array<{ id: number; arquivo_nome: string; tipo: string; mes: number; ano: number; data_upload: string; linhas_importadas: number; status: string }>).map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #F9FAFB' }} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-4 py-2.5 max-w-[200px] truncate" style={{ color: '#1A1A2E' }}>{h.arquivo_nome}</td>
                  <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{h.tipo}</td>
                  <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{h.mes ? `${MESES[h.mes]}/${h.ano}` : '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: '#6B7280' }}>{new Date(h.data_upload).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-right" style={{ color: '#1A1A2E' }}>{h.linhas_importadas}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={h.status === 'ok' ? { background: '#EEF5D6', color: '#4A7000' } : { background: '#FEE8E8', color: '#CC1111' }}>
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#D1D5DB' }}>Nenhum upload registrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
