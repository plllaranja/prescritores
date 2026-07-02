'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Bot, User, PlusCircle } from 'lucide-react'

interface Mensagem {
  tipo: 'user' | 'bot'
  texto: string
  dados?: unknown
  sugestoes?: string[]
  intencao?: string
}

const SUGESTOES_INICIAIS = [
  'Quem caiu mais esse mês?',
  'Quem está em risco de abandono?',
  'Qual o melhor ROI por visita?',
  'Como está a positivação de cada representante?',
]

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

function RenderDados({ dados }: { dados: unknown }) {
  if (!dados) return null
  if (Array.isArray(dados)) {
    if (dados.length === 0) return null
    const keys = Object.keys(dados[0] as object)
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-gray-700">
              {keys.map(k => <th key={k} className="text-left py-1.5 pr-3 text-gray-400 capitalize">{k.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {(dados as Record<string, unknown>[]).slice(0, 20).map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {keys.map(k => (
                  <td key={k} className="py-1.5 pr-3 text-gray-200">
                    {typeof row[k] === 'number' && k.includes('valor') ? fmt(row[k] as number)
                      : typeof row[k] === 'boolean' ? (row[k] ? '✓' : '✗')
                      : String(row[k] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (typeof dados === 'object' && dados !== null) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(dados as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="bg-gray-800/50 rounded px-2 py-1.5">
            <p className="text-xs text-gray-500 capitalize">{k.replace(/_/g, ' ')}</p>
            <p className="text-sm text-white">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Agente() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      tipo: 'bot',
      texto: 'Olá! Posso responder perguntas sobre prescritores, representantes e desempenho comercial com base nos dados importados. O que quer saber?',
      sugestoes: SUGESTOES_INICIAIS,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  const enviar = async (texto: string) => {
    if (!texto.trim() || loading) return
    const novaMsg: Mensagem = { tipo: 'user', texto }
    setMensagens(prev => [...prev, novaMsg])
    setInput('')
    setLoading(true)

    const res = await fetch('/api/agente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: texto }),
    })
    const json = await res.json()
    setMensagens(prev => [...prev, {
      tipo: 'bot',
      texto: json.resposta,
      dados: json.dados,
      sugestoes: json.sugestoes,
      intencao: json.intencao,
    }])
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Agente de Perguntas</h1>
        <p className="text-gray-400 text-sm mt-1">Consulte dados de prescritores em linguagem natural</p>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.tipo === 'bot' && (
              <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-blue-400" />
              </div>
            )}
            <div className={`max-w-[80%] ${m.tipo === 'user' ? 'order-first' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 ${m.tipo === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-900 border border-gray-800 text-gray-100'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                {m.tipo === 'bot' && m.dados && <RenderDados dados={m.dados} />}
              </div>
              {m.tipo === 'bot' && m.sugestoes && m.sugestoes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.sugestoes.map((s, j) => (
                    <button key={j} onClick={() => enviar(s)} className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition flex items-center gap-1">
                      <PlusCircle size={12} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {m.tipo === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User size={16} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center">
              <Bot size={16} className="text-blue-400" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex gap-3 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input) } }}
          placeholder="Pergunte sobre prescritores, representantes, tendências..."
          rows={1}
          className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-600 resize-none focus:outline-none"
        />
        <button
          onClick={() => enviar(input)} disabled={!input.trim() || loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2 rounded-lg transition"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
