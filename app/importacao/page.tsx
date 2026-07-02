'use client'
import { useState, useRef, useCallback } from 'react'
import { UploadCloud, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw, Download } from 'lucide-react'

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

  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle size={16} className="text-green-400" />
    if (status === 'erro') return <XCircle size={16} className="text-red-400" />
    if (status === 'ja_existe') return <AlertCircle size={16} className="text-yellow-400" />
    return <Clock size={16} className="text-gray-400" />
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Importação de Dados</h1>
          <p className="text-gray-400 text-sm mt-1">Arraste arquivos .xlsx de vendas e visitas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarHistorico} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition">
            <Clock size={14} /> Histórico
          </button>
          <a href="/api/backup" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition">
            <Download size={14} /> Backup
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(['upload', 'revisao', 'historico'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
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
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${dragging ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'}`}
          >
            <UploadCloud size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-300 font-medium">Arraste os arquivos .xlsx aqui</p>
            <p className="text-gray-500 text-sm mt-1">Ou clique para selecionar — aceita múltiplos arquivos de visitas e vendas</p>
            <input ref={inputRef} type="file" multiple accept=".xlsx" className="hidden" onChange={onFileChange} />
          </div>

          {/* Arquivos selecionados */}
          {files.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
              <p className="text-sm text-gray-400 mb-3">Arquivos selecionados ({files.length}):</p>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-200">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 text-xs ml-4">remover</button>
                </div>
              ))}
              <button
                onClick={handleUpload} disabled={loading}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? <><RefreshCw size={16} className="animate-spin" /> Processando...</> : 'Confirmar e Importar'}
              </button>
            </div>
          )}

          {/* Relatório */}
          {relatorio && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-semibold text-white mb-3">Resultado da importação</h3>
              <div className="space-y-2">
                {relatorio.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-lg px-3 py-2.5">
                    {statusIcon(r.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.arquivo}</p>
                      <p className="text-xs text-gray-400">
                        {r.tipo} {r.mes ? `· ${MESES[r.mes]}/${r.ano}` : ''} · {r.linhas} linhas
                        {r.mensagem ? ` · ${r.mensagem}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'ok' ? 'bg-green-900/50 text-green-300' : r.status === 'erro' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
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
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
              <CheckCircle size={40} className="mx-auto text-green-700 mb-3" />
              Nenhum match pendente de revisão.
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-4">
                Esses matches têm score entre 70–84. Confirme ou rejeite cada um.
              </p>
              <div className="space-y-3">
                {matches.map(m => (
                  <div key={m.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Visita</p>
                        <p className="text-sm text-white">{m.nome_visita}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Candidato (score: {m.score.toFixed(0)})</p>
                        <p className="text-sm text-yellow-300">{m.nome_candidato}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resolverMatch(m.id, 'confirmar')} className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded">Confirmar</button>
                      <button onClick={() => resolverMatch(m.id, 'rejeitar')} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded">Rejeitar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-left">
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Data Upload</th>
                <th className="px-4 py-3 text-right">Linhas</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {(historico as Array<{ id: number; arquivo_nome: string; tipo: string; mes: number; ano: number; data_upload: string; linhas_importadas: number; status: string }>).map(h => (
                <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-gray-300 max-w-[200px] truncate">{h.arquivo_nome}</td>
                  <td className="px-4 py-2.5 text-gray-400">{h.tipo}</td>
                  <td className="px-4 py-2.5 text-gray-400">{h.mes ? `${MESES[h.mes]}/${h.ano}` : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400">{new Date(h.data_upload).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{h.linhas_importadas}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${h.status === 'ok' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{h.status}</span>
                  </td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Nenhum upload registrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
