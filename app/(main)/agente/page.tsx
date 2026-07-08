'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, PlusCircle, AlertCircle } from 'lucide-react'

interface Mensagem {
  tipo: 'user' | 'bot'
  texto: string
  erro?: boolean
}

const SUGESTOES_INICIAIS = [
  'Quem fez mais visitas cada mês?',
  'Quem está em risco de abandono?',
  'Qual o melhor ROI por visita?',
  'Como está a positivação de cada representante?',
  'Quem caiu mais esse mês?',
  'Me dá um resumo geral da carteira',
]

// Renderiza **negrito** e listas simples
function TextoFormatado({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  return (
    <div className="text-sm space-y-1">
      {linhas.map((linha, i) => {
        if (!linha.trim()) return <div key={i} className="h-1" />
        // Bullet
        const isBullet = /^[-•*]\s/.test(linha)
        const isNum = /^\d+\.\s/.test(linha)
        const content = linha.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        return (
          <p
            key={i}
            className={isBullet || isNum ? 'pl-3' : ''}
            dangerouslySetInnerHTML={{ __html: (isBullet ? '• ' : '') + content.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, (m) => m) }}
          />
        )
      })}
    </div>
  )
}

export default function Agente() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      tipo: 'bot',
      texto: 'Olá! Sou seu analista de prescritores com IA. Posso analisar sua carteira, identificar riscos, comparar representantes e muito mais. O que quer saber?',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [semApiKey, setSemApiKey] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  const historico = mensagens
    .filter(m => !m.erro)
    .map(m => ({ role: m.tipo === 'user' ? 'user' as const : 'assistant' as const, content: m.texto }))

  const enviar = async (texto: string) => {
    if (!texto.trim() || loading) return
    setMensagens(prev => [...prev, { tipo: 'user', texto }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico }),
      })
      const json = await res.json()

      if (json.erro === 'sem_api_key') setSemApiKey(true)

      setMensagens(prev => [...prev, {
        tipo: 'bot',
        texto: json.resposta ?? 'Erro ao obter resposta.',
        erro: !!json.erro,
      }])
    } catch {
      setMensagens(prev => [...prev, { tipo: 'bot', texto: 'Erro de conexão. Tente novamente.', erro: true }])
    }
    setLoading(false)
  }

  return (
    <div className="lf-chat flex flex-col max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Agente IA</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Análise inteligente da sua carteira de prescritores</p>
      </div>

      {semApiKey && (
        <div className="mb-4 rounded-xl p-4 flex gap-3" style={{ background: '#FFF3CD', border: '1px solid #FFCB00' }}>
          <AlertCircle size={18} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#B45309' }}>Chave da API não configurada</p>
            <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>
              Crie o arquivo <code className="bg-amber-100 px-1 rounded">.env.local</code> na raiz do projeto com:
              <br /><code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY=sk-...</code>
            </p>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.tipo === 'bot' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: '#E7F8FF', color: '#009EE2' }}>
                <Bot size={15} />
              </div>
            )}
            <div className={`max-w-[88%] sm:max-w-[80%] ${m.tipo === 'user' ? 'order-first' : ''}`}>
              <div
                className="rounded-2xl px-4 py-3"
                style={m.tipo === 'user'
                  ? { background: '#2C4A9A', color: '#fff' }
                  : m.erro
                    ? { background: '#FFF3CD', border: '1px solid #FFCB00', color: '#92400E' }
                    : { background: '#fff', border: '1px solid #E8E8E8', color: '#1A1A2E', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
                }
              >
                {m.tipo === 'user'
                  ? <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                  : <TextoFormatado texto={m.texto} />
                }
              </div>
            </div>
            {m.tipo === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: '#EAF0FF', color: '#2C4A9A' }}>
                <User size={15} />
              </div>
            )}
          </div>
        ))}

        {/* Sugestões iniciais */}
        {mensagens.length === 1 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {SUGESTOES_INICIAIS.map((s, j) => (
              <button
                key={j} onClick={() => enviar(s)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                style={{ background: '#F5F7FA', border: '1px solid #E8E8E8', color: '#2C4A9A' }}
              >
                <PlusCircle size={11} /> {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#E7F8FF', color: '#009EE2' }}>
              <Bot size={15} />
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: '#fff', border: '1px solid #E8E8E8' }}>
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#009EE2', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#009EE2', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#009EE2', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="rounded-xl p-3 flex gap-3 items-end" style={{ background: '#fff', border: '1px solid #E8E8E8', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input) } }}
          placeholder="Pergunte sobre prescritores, representantes, tendências..."
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none focus:outline-none"
          style={{ color: '#1A1A2E' }}
        />
        <button
          onClick={() => enviar(input)} disabled={!input.trim() || loading}
          className="p-2 rounded-lg transition-colors disabled:opacity-40"
          style={{ background: '#009EE2', color: '#fff' }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
