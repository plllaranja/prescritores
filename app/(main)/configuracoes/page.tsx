'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, RefreshCw, Users, Settings, AlertTriangle, MapPin, Search, UserPlus, Shield, Trash2, KeyRound } from 'lucide-react'

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }
const INPUT_STYLE: React.CSSProperties = { border: '1px solid #E8E8E8', background: '#F9FAFB', color: '#1A1A2E', borderRadius: 8, padding: '6px 12px', fontSize: 14, width: '100%' }

interface Config { chave: string; valor: string; descricao: string }
interface Representante {
  id: number; nome: string; territorio: string | null
  visitas_por_dia: number; ativo: number; pendente_configuracao: number
  prescritores_carteira: number; total_visitas: number
}
interface Prescritor {
  id: number; nome_canonico: string; tipo_entidade: string
  cidade: string | null; bairro: string | null; logradouro: string | null
}
interface Usuario {
  id: number; nome: string; email: string; role: 'admin' | 'rep'
  representante_id: number | null; ativo: number; criado_em: string
}

export default function Configuracoes() {
  const [tab, setTab] = useState<'representantes' | 'prescritores' | 'usuarios' | 'parametros'>('representantes')
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', senha: '', role: 'rep', representante_id: '' })
  const [criandoUser, setCriandoUser] = useState(false)
  const [resetSenha, setResetSenha] = useState<{ id: number; senha: string } | null>(null)
  const [reps, setReps] = useState<Representante[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [editRep, setEditRep] = useState<Record<number, Partial<Representante>>>({})
  const [editCfg, setEditCfg] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  // Prescritores tab state
  const [prescritores, setPrescritores] = useState<Prescritor[]>([])
  const [buscaPresc, setBuscaPresc] = useState('')
  const [editPresc, setEditPresc] = useState<Record<number, Partial<Prescritor>>>({})
  const [salvandoPresc, setSalvandoPresc] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/representantes').then(r => r.json()).then(setReps)
    fetch('/api/configuracoes').then(r => r.json()).then(setConfigs)
    fetch('/api/auth/me').then(r => r.json()).then(u => setCurrentUser(u))
  }, [])

  const carregarUsuarios = useCallback(async () => {
    const data = await fetch('/api/auth/cadastro').then(r => r.json())
    // reutilizamos a rota GET que retorna has_users — precisamos de uma rota de listagem
    // Chamamos /api/usuarios (que criaremos inline abaixo via a rota de cadastro extendida)
    const list = await fetch('/api/usuarios').then(r => r.json())
    setUsuarios(list)
  }, [])

  useEffect(() => {
    if (tab === 'usuarios') carregarUsuarios()
  }, [tab, carregarUsuarios])

  const criarUsuario = async () => {
    setCriandoUser(true)
    const res = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...novoUser, representante_id: novoUser.representante_id ? Number(novoUser.representante_id) : null }),
    })
    setCriandoUser(false)
    if (res.ok) {
      setNovoUser({ nome: '', email: '', senha: '', role: 'rep', representante_id: '' })
      carregarUsuarios()
    }
  }

  const excluirUsuario = async (id: number) => {
    if (!confirm('Excluir este usuário?')) return
    await fetch('/api/auth/cadastro', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    carregarUsuarios()
  }

  const salvarResetSenha = async () => {
    if (!resetSenha) return
    const u = usuarios.find(x => x.id === resetSenha.id)
    if (!u) return
    await fetch('/api/auth/cadastro', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...u, senha: resetSenha.senha }),
    })
    setResetSenha(null)
  }

  const carregarPrescritores = useCallback(async (q = '') => {
    const url = q ? `/api/prescritores?q=${encodeURIComponent(q)}` : '/api/prescritores'
    const data = await fetch(url).then(r => r.json())
    setPrescritores(data)
  }, [])

  useEffect(() => {
    if (tab === 'prescritores') carregarPrescritores(buscaPresc)
  }, [tab, buscaPresc, carregarPrescritores])

  const updatePresc = (id: number, field: string, value: string) =>
    setEditPresc(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const salvarPresc = async (p: Prescritor) => {
    setSalvandoPresc(p.id)
    const changes = editPresc[p.id] ?? {}
    const updated = { ...p, ...changes }
    await fetch('/api/prescritores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setPrescritores(prev => prev.map(x => x.id === p.id ? updated : x))
    setEditPresc(prev => { const n = { ...prev }; delete n[p.id]; return n })
    setSalvandoPresc(null)
  }

  const updateRep = (id: number, field: string, value: unknown) => {
    setEditRep(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const salvarRep = async (rep: Representante) => {
    const changes = editRep[rep.id] ?? {}
    const updated = { ...rep, ...changes }
    await fetch('/api/representantes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setReps(prev => prev.map(r => r.id === rep.id ? updated as Representante : r))
    setEditRep(prev => { const n = { ...prev }; delete n[rep.id]; return n })
  }

  const salvarConfigs = async () => {
    setSalvando(true)
    const updates = Object.entries(editCfg).map(([chave, valor]) => ({ chave, valor }))
    if (updates.length > 0) {
      await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setConfigs(prev => prev.map(c => editCfg[c.chave] !== undefined ? { ...c, valor: editCfg[c.chave] } : c))
      setEditCfg({})
    }
    setSalvando(false)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }

  // Grupos de configuração
  const cfgExclusoes = configs.filter(c => c.chave === 'exclusoes_vendas' || c.chave === 'termos_hospital')
  const cfgFuzzy = configs.filter(c => c.chave.startsWith('fuzzy_'))
  const cfgValores = configs.filter(c => c.chave.startsWith('valor_') || c.chave.startsWith('meses_'))
  const cfgTemas = configs.filter(c => c.chave.startsWith('tema_'))
  const cfgOutros = configs.filter(c => c.chave === 'dias_sem_visita_alerta')

  const renderConfig = (c: Config) => (
    <div key={c.chave} className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 py-3" style={{ borderBottom: '1px solid #F0F0F0' }}>
      <div className="sm:col-span-1">
        <p className="text-sm font-medium" style={{ color: '#1A1A2E' }}>{c.chave}</p>
        {c.descricao && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{c.descricao}</p>}
      </div>
      <div className="sm:col-span-2">
        <input
          value={editCfg[c.chave] ?? c.valor}
          onChange={e => setEditCfg(prev => ({ ...prev, [c.chave]: e.target.value }))}
          style={INPUT_STYLE}
          className="focus:outline-none"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl w-full">
      <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Configurações</h1>

      <div style={{ borderBottom: '1px solid #E8E8E8' }} className="flex overflow-x-auto">
        {([
          { key: 'representantes', label: 'Representantes', icon: <Users size={15} />, adminOnly: false },
          { key: 'prescritores', label: 'Localização', icon: <MapPin size={15} />, adminOnly: false },
          { key: 'usuarios', label: 'Usuários', icon: <UserPlus size={15} />, adminOnly: true },
          { key: 'parametros', label: 'Parâmetros', icon: <Settings size={15} />, adminOnly: false },
        ] as const).filter(t => !t.adminOnly || currentUser?.role === 'admin').map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2.5 text-sm flex items-center gap-2 font-medium transition-colors"
            style={tab === key ? { borderBottom: '2px solid #009EE2', color: '#009EE2', marginBottom: -1 } : { color: '#9CA3AF' }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'representantes' && (
        <div className="space-y-4">
          {reps.filter(r => r.pendente_configuracao).length > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm" style={{ background: '#FFF8CC', border: '1px solid #F0D800', color: '#A07C00' }}>
              <AlertTriangle size={15} /> {reps.filter(r => r.pendente_configuracao).length} representante(s) detectado(s) aguardando configuração de território.
            </div>
          )}
          <div style={CARD} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                  {['Nome', 'Território', 'Visitas/dia', 'Ativo', 'Carteira', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reps.map(rep => {
                  const changes = editRep[rep.id] ?? {}
                  const nome = changes.nome ?? rep.nome
                  const territorio = changes.territorio ?? rep.territorio
                  const vpd = changes.visitas_por_dia ?? rep.visitas_por_dia
                  const ativo = changes.ativo ?? rep.ativo
                  const hasChanges = Object.keys(changes).length > 0
                  return (
                    <tr key={rep.id} style={{ borderBottom: '1px solid #F9FAFB', background: rep.pendente_configuracao ? '#FFFDF0' : undefined }}>
                      <td className="px-4 py-2.5">
                        <input value={nome} onChange={e => updateRep(rep.id, 'nome', e.target.value)}
                          style={{ ...INPUT_STYLE, width: 180 }}
                          className="focus:outline-none" />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={territorio ?? ''} onChange={e => updateRep(rep.id, 'territorio', e.target.value || null)}
                          style={{ ...INPUT_STYLE, width: 'auto', border: !territorio ? '1px solid #F0D800' : '1px solid #E8E8E8' }}
                          className="focus:outline-none">
                          <option value="">Não definido</option>
                          <option value="Curitiba">Curitiba</option>
                          <option value="Ponta Grossa">Ponta Grossa</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" value={vpd} onChange={e => updateRep(rep.id, 'visitas_por_dia', Number(e.target.value))}
                          style={{ ...INPUT_STYLE, width: 64 }}
                          className="focus:outline-none" min={1} max={20} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => updateRep(rep.id, 'ativo', ativo ? 0 : 1)}
                          className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                          style={ativo ? { background: '#EEF5D6', color: '#4A7000' } : { background: '#F5F7FA', color: '#9CA3AF' }}>
                          {ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>{rep.prescritores_carteira} prescritores</td>
                      <td className="px-4 py-2.5">
                        {hasChanges && (
                          <button onClick={() => salvarRep(rep)} className="text-xs font-medium px-3 py-1 rounded-lg" style={{ background: '#009EE2', color: '#fff' }}>Salvar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {reps.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#D1D5DB' }}>Nenhum representante detectado ainda. Importe arquivos de visitas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'prescritores' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input
                value={buscaPresc}
                onChange={e => setBuscaPresc(e.target.value)}
                placeholder="Buscar prescritor..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ border: '1px solid #E8E8E8', background: '#F9FAFB', color: '#1A1A2E' }}
              />
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {prescritores.length} prescritor(es) — cidade e bairro são usados para agrupar visitas geograficamente no cronograma
            </p>
          </div>

          <div style={CARD} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>Prescritor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>Endereço / Logradouro</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>Bairro</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>Cidade</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {prescritores.map(p => {
                  const changes = editPresc[p.id] ?? {}
                  const cidade = changes.cidade ?? p.cidade ?? ''
                  const bairro = changes.bairro ?? p.bairro ?? ''
                  const logradouro = changes.logradouro ?? p.logradouro ?? ''
                  const hasChanges = Object.keys(changes).length > 0
                  const temLoc = p.cidade || p.bairro || p.logradouro
                  const mapsUrl = temLoc
                    ? `https://www.google.com/maps/search/${encodeURIComponent([logradouro, bairro, cidade].filter(Boolean).join(', '))}`
                    : null
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F9FAFB' }} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[200px]" style={{ color: '#1A1A2E' }}>{p.nome_canonico}</span>
                          {temLoc && mapsUrl && (
                            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              style={{ background: '#E7F8FF', color: '#007AB8' }}
                              title="Ver no Maps"
                            >
                              <MapPin size={10} />Maps
                            </a>
                          )}
                        </div>
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>{p.tipo_entidade === 'hospital' ? 'Hospital' : 'Médico'}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={logradouro}
                          onChange={e => updatePresc(p.id, 'logradouro', e.target.value)}
                          placeholder="ex: Rua XV de Novembro, 123"
                          className="focus:outline-none"
                          style={{ ...INPUT_STYLE, width: 200 }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={bairro}
                          onChange={e => updatePresc(p.id, 'bairro', e.target.value)}
                          placeholder="ex: Centro"
                          className="focus:outline-none"
                          style={{ ...INPUT_STYLE, width: 130 }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={cidade}
                          onChange={e => updatePresc(p.id, 'cidade', e.target.value)}
                          placeholder="ex: Curitiba"
                          className="focus:outline-none"
                          style={{ ...INPUT_STYLE, width: 120 }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        {hasChanges && (
                          <button
                            onClick={() => salvarPresc(p)}
                            disabled={salvandoPresc === p.id}
                            className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50"
                            style={{ background: '#009EE2', color: '#fff' }}
                          >
                            {salvandoPresc === p.id ? <RefreshCw size={12} className="animate-spin inline" /> : 'Salvar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {prescritores.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: '#D1D5DB' }}>
                    Nenhum prescritor encontrado. Importe arquivos de visitas primeiro.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="space-y-5">
          {/* Criar novo usuário */}
          <div style={CARD} className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A1A2E' }}>
              <UserPlus size={16} style={{ color: '#009EE2' }} /> Novo usuário
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>Nome</label>
                <input value={novoUser.nome} onChange={e => setNovoUser(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" style={INPUT_STYLE} className="focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>E-mail</label>
                <input type="email" value={novoUser.email} onChange={e => setNovoUser(p => ({ ...p, email: e.target.value }))} placeholder="email@lefarma.com.br" style={INPUT_STYLE} className="focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>Senha inicial</label>
                <input type="password" value={novoUser.senha} onChange={e => setNovoUser(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" style={INPUT_STYLE} className="focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>Perfil</label>
                <select value={novoUser.role} onChange={e => setNovoUser(p => ({ ...p, role: e.target.value }))} style={INPUT_STYLE} className="focus:outline-none">
                  <option value="rep">Representante</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>Vincular a representante <span style={{ color: '#C0C0C0' }}>(opcional — filtra dashboard)</span></label>
                <select value={novoUser.representante_id} onChange={e => setNovoUser(p => ({ ...p, representante_id: e.target.value }))} style={INPUT_STYLE} className="focus:outline-none">
                  <option value="">Nenhum (vê todos os dados)</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.nome} {r.territorio ? `· ${r.territorio}` : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={criarUsuario}
                disabled={criandoUser || !novoUser.nome || !novoUser.email || !novoUser.senha}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
                style={{ background: '#009EE2', color: '#fff' }}
              >
                {criandoUser ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Criar usuário
              </button>
            </div>
          </div>

          {/* Lista de usuários */}
          <div style={CARD} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                  {['Usuário', 'Perfil', 'Representante', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#9CA3AF' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#EAF0FF', color: '#2C4A9A' }}>
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: '#1A1A2E' }}>{u.nome}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit"
                        style={u.role === 'admin' ? { background: '#FFF8CC', color: '#A07C00' } : { background: '#EAF0FF', color: '#2C4A9A' }}>
                        {u.role === 'admin' && <Shield size={10} />}
                        {u.role === 'admin' ? 'Admin' : 'Representante'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                      {reps.find(r => r.id === u.representante_id)?.nome ?? <span style={{ color: '#C0C0C0' }}>Todos</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={u.ativo ? { background: '#EEF5D6', color: '#4A7000' } : { background: '#F5F7FA', color: '#9CA3AF' }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Reset senha */}
                        {resetSenha?.id === u.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="password"
                              value={resetSenha.senha}
                              onChange={e => setResetSenha(p => p ? { ...p, senha: e.target.value } : null)}
                              placeholder="Nova senha"
                              className="text-xs px-2 py-1 rounded focus:outline-none w-28"
                              style={{ border: '1px solid #E8E8E8', background: '#F9FAFB', color: '#1A1A2E' }}
                            />
                            <button onClick={salvarResetSenha} className="text-xs px-2 py-1 rounded" style={{ background: '#88A201', color: '#fff' }}>OK</button>
                            <button onClick={() => setResetSenha(null)} className="text-xs px-2 py-1 rounded" style={{ background: '#F5F7FA', color: '#9CA3AF' }}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setResetSenha({ id: u.id, senha: '' })}
                            className="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors hover:bg-gray-100"
                            style={{ color: '#6B7280', border: '1px solid #E8E8E8' }}
                          >
                            <KeyRound size={11} /> Senha
                          </button>
                        )}
                        {currentUser?.id !== u.id && (
                          <button onClick={() => excluirUsuario(u.id)} className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity">
                            <Trash2 size={14} style={{ color: '#CC1111' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: '#D1D5DB' }}>Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'parametros' && (
        <div className="space-y-6">
          <Section title="Listas de exclusão / detecção">
            {cfgExclusoes.map(renderConfig)}
          </Section>
          <Section title="Fuzzy matching">
            {cfgFuzzy.map(renderConfig)}
          </Section>
          <Section title="Limites de valor (R$)">
            {[...cfgValores, ...cfgOutros].map(renderConfig)}
          </Section>
          <Section title="Temas por dia da semana">
            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Categorias separadas por vírgula. Dias: segunda (1), terça (2), quarta (3), quinta (4), sexta (5)</p>
            {cfgTemas.map(renderConfig)}
          </Section>
          <div className="flex justify-end">
            <button
              onClick={salvarConfigs} disabled={salvando}
              className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: ok ? '#88A201' : '#009EE2', color: '#fff' }}
            >
              {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {ok ? 'Salvo!' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }} className="p-5">
      <h3 className="font-semibold mb-4" style={{ color: '#1A1A2E' }}>{title}</h3>
      {children}
    </div>
  )
}
