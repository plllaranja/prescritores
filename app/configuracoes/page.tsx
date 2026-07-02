'use client'
import { useState, useEffect } from 'react'
import { Save, RefreshCw, Users, Settings, AlertTriangle } from 'lucide-react'

interface Config { chave: string; valor: string; descricao: string }
interface Representante {
  id: number; nome: string; territorio: string | null
  visitas_por_dia: number; ativo: number; pendente_configuracao: number
  prescritores_carteira: number; total_visitas: number
}

export default function Configuracoes() {
  const [tab, setTab] = useState<'representantes' | 'parametros'>('representantes')
  const [reps, setReps] = useState<Representante[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [editRep, setEditRep] = useState<Record<number, Partial<Representante>>>({})
  const [editCfg, setEditCfg] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    fetch('/api/representantes').then(r => r.json()).then(setReps)
    fetch('/api/configuracoes').then(r => r.json()).then(setConfigs)
  }, [])

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
    <div key={c.chave} className="grid grid-cols-3 gap-4 py-3 border-b border-gray-800">
      <div className="col-span-1">
        <p className="text-sm text-gray-200 font-medium">{c.chave}</p>
        {c.descricao && <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>}
      </div>
      <div className="col-span-2">
        <input
          value={editCfg[c.chave] ?? c.valor}
          onChange={e => setEditCfg(prev => ({ ...prev, [c.chave]: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Configurações</h1>

      <div className="flex border-b border-gray-800">
        <button onClick={() => setTab('representantes')} className={`px-4 py-2 text-sm flex items-center gap-2 ${tab === 'representantes' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Users size={16} /> Representantes
        </button>
        <button onClick={() => setTab('parametros')} className={`px-4 py-2 text-sm flex items-center gap-2 ${tab === 'parametros' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Settings size={16} /> Parâmetros
        </button>
      </div>

      {tab === 'representantes' && (
        <div className="space-y-4">
          {reps.filter(r => r.pendente_configuracao).length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-800/50 rounded-lg px-4 py-2.5 text-yellow-300 text-sm">
              <AlertTriangle size={16} /> {reps.filter(r => r.pendente_configuracao).length} representante(s) detectado(s) aguardando configuração de território.
            </div>
          )}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Território</th>
                  <th className="text-left px-4 py-3">Visitas/dia</th>
                  <th className="text-left px-4 py-3">Ativo</th>
                  <th className="text-left px-4 py-3">Carteira</th>
                  <th className="px-4 py-3"></th>
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
                    <tr key={rep.id} className={`border-b border-gray-800/50 ${rep.pendente_configuracao ? 'bg-yellow-950/10' : ''}`}>
                      <td className="px-4 py-2.5">
                        <input value={nome} onChange={e => updateRep(rep.id, 'nome', e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 w-48 focus:outline-none focus:border-blue-500" />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={territorio ?? ''} onChange={e => updateRep(rep.id, 'territorio', e.target.value || null)}
                          className={`bg-gray-800 border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none ${!territorio ? 'border-yellow-700' : 'border-gray-700'}`}>
                          <option value="">Não definido</option>
                          <option value="Curitiba">Curitiba</option>
                          <option value="Ponta Grossa">Ponta Grossa</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" value={vpd} onChange={e => updateRep(rep.id, 'visitas_por_dia', Number(e.target.value))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 w-16 focus:outline-none" min={1} max={20} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => updateRep(rep.id, 'ativo', ativo ? 0 : 1)}
                          className={`text-xs px-2 py-1 rounded ${ativo ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                          {ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{rep.prescritores_carteira} prescritores</td>
                      <td className="px-4 py-2.5">
                        {hasChanges && (
                          <button onClick={() => salvarRep(rep)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded">Salvar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {reps.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Nenhum representante detectado ainda. Importe arquivos de visitas.</td></tr>
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
            <p className="text-xs text-gray-500 mb-3">Categorias separadas por vírgula. Dias: segunda (1), terça (2), quarta (3), quinta (4), sexta (5)</p>
            {cfgTemas.map(renderConfig)}
          </Section>
          <div className="flex justify-end">
            <button onClick={salvarConfigs} disabled={salvando} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm transition">
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  )
}
