'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, UserPlus, LogIn, RefreshCw } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'cadastro'>('login')
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/auth/cadastro').then(r => r.json()).then(d => {
      setHasUsers(d.has_users)
      if (!d.has_users) setMode('cadastro')
    })
  }, [])

  const submit = async () => {
    setErro('')
    if (!form.email || !form.senha) { setErro('Preencha email e senha'); return }
    if (mode === 'cadastro' && !form.nome) { setErro('Preencha o nome'); return }

    setLoading(true)
    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/cadastro'
    const body = mode === 'login'
      ? { email: form.email, senha: form.senha }
      : { nome: form.nome, email: form.email, senha: form.senha, role: 'admin' }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({ error: 'Resposta inválida do servidor' }))

    if (!res.ok) {
      setErro(json.error ?? 'Erro desconhecido')
      setLoading(false)
      return
    }

    if (mode === 'cadastro' && !hasUsers) {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      })
    }

    router.push('/')
    router.refresh()
  }

  if (hasUsers === null) return null

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F7FA' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl mx-auto mb-3" style={{ background: '#2C4A9A', color: '#FFCB00' }}>
            LF
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Le Farma</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Painel de Prescritores</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #F0F0F0' }} className="p-8">
          {!hasUsers && (
            <div className="flex items-start gap-3 rounded-xl p-3 mb-6" style={{ background: '#FFF8CC', border: '1px solid #F0D800' }}>
              <Shield size={16} style={{ color: '#A07C00', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: '#A07C00' }}>
                <strong>Primeiro acesso.</strong> Crie o usuário administrador para começar.
              </p>
            </div>
          )}

          <h2 className="text-lg font-bold mb-6" style={{ color: '#1A1A2E' }}>
            {mode === 'login' ? 'Entrar na plataforma' : 'Criar conta de administrador'}
          </h2>

          <div className="space-y-4">
            {mode === 'cadastro' && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>Nome completo</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none"
                  style={{ border: '1px solid #E8E8E8', color: '#1A1A2E', background: '#F9FAFB' }}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@lefarma.com.br"
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none"
                style={{ border: '1px solid #E8E8E8', color: '#1A1A2E', background: '#F9FAFB' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={form.senha}
                  onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
                  placeholder={mode === 'cadastro' ? 'Mínimo 6 caracteres' : '********'}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg focus:outline-none"
                  style={{ border: '1px solid #E8E8E8', color: '#1A1A2E', background: '#F9FAFB' }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#9CA3AF' }}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {erro && (
            <div className="mt-4 text-sm px-3 py-2 rounded-lg" style={{ background: '#FEE8E8', color: '#CC1111' }}>
              {erro}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full mt-6 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            style={{ background: '#2C4A9A', color: '#fff' }}
          >
            {loading
              ? <><RefreshCw size={16} className="animate-spin" /> Aguarde...</>
              : mode === 'login'
                ? <><LogIn size={16} /> Entrar</>
                : <><UserPlus size={16} /> Criar conta</>
            }
          </button>

          {hasUsers && (
            <p className="text-center mt-5 text-sm" style={{ color: '#9CA3AF' }}>
              Precisa de acesso? Peça para um administrador criar seu usuário em Configurações.
            </p>
          )}
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: '#C0C0C0' }}>
          Le Farma · Sistema interno
        </p>
      </div>
    </div>
  )
}
