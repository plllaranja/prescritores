'use client'
import { useState } from 'react'
import {
  UploadCloud, LayoutDashboard, MessageSquare, Calendar, Settings,
  CheckCircle, ChevronDown, ChevronRight, MapPin, ClipboardList,
  FileSpreadsheet, Zap, AlertTriangle, TrendingUp, Users, BookOpen,
} from 'lucide-react'

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0',
}

interface Step { icon: React.ReactNode; title: string; desc: string }
interface Section {
  id: string
  icon: React.ReactNode
  color: string
  bg: string
  title: string
  subtitle: string
  steps: Step[]
  dica?: string
}

const SECTIONS: Section[] = [
  {
    id: 'inicio',
    icon: <Zap size={20} />,
    color: '#A07C00',
    bg: '#FFF8CC',
    title: 'Primeiros passos',
    subtitle: 'Como começar do zero',
    steps: [
      {
        icon: <FileSpreadsheet size={16} />,
        title: 'Prepare os arquivos .xlsx',
        desc: 'Você vai precisar de dois tipos de planilha: arquivos de visitas (com colunas de data, nome do cliente, representante) e arquivos de vendas mensais (com nome do prescritor e valor). Os nomes das colunas não precisam ser exatos — o sistema detecta automaticamente.',
      },
      {
        icon: <UploadCloud size={16} />,
        title: 'Faça o primeiro upload',
        desc: 'Vá em Importação e arraste todos os arquivos de uma vez. Pode misturar meses e tipos — o sistema identifica o que é visita e o que é venda pelo conteúdo.',
      },
      {
        icon: <CheckCircle size={16} />,
        title: 'Revise os matches incertos',
        desc: 'Após o upload, a aba "Revisão" aparece com nomes que o sistema não tinha certeza se eram o mesmo prescritor. Confirme ou rejeite cada um — isso treina o sistema para o futuro.',
      },
      {
        icon: <Settings size={16} />,
        title: 'Configure os representantes',
        desc: 'Vá em Configurações → Representantes e defina o território (Curitiba ou Ponta Grossa) e quantas visitas por dia cada um faz. Representantes são detectados automaticamente dos arquivos importados.',
      },
    ],
    dica: 'Importe sempre os arquivos mais antigos primeiro, assim a evolução histórica fica correta no gráfico.',
  },
  {
    id: 'importacao',
    icon: <UploadCloud size={20} />,
    color: '#007AB8',
    bg: '#E7F8FF',
    title: 'Importação',
    subtitle: 'Como funciona o processamento dos arquivos',
    steps: [
      {
        icon: <FileSpreadsheet size={16} />,
        title: 'Formato aceito',
        desc: 'Apenas arquivos .xlsx. Você pode importar vários de uma vez. O sistema aceita planilhas de visitas e planilhas de vendas no mesmo upload.',
      },
      {
        icon: <Zap size={16} />,
        title: 'Matching automático de nomes',
        desc: 'O sistema usa similaridade de texto (fuzzy matching) para vincular nomes de visitas com nomes de vendas. Scores acima de 85% são aceitos automaticamente. Entre 70–84%, vão para revisão manual.',
      },
      {
        icon: <CheckCircle size={16} />,
        title: 'Aba Revisão',
        desc: 'Aparecem os matches incertos. "Confirmar" vincula aquele nome ao prescritor e o sistema aprende para sempre. "Rejeitar" mantém os registros separados.',
      },
      {
        icon: <ClipboardList size={16} />,
        title: 'Aba Histórico',
        desc: 'Lista todos os uploads já feitos com data, tipo, período e quantidade de linhas importadas. Use o botão "Backup" para baixar o banco de dados completo.',
      },
    ],
    dica: 'Se um arquivo for importado duas vezes, o sistema detecta duplicata e ignora — sem risco de duplicar dados.',
  },
  {
    id: 'dashboard',
    icon: <LayoutDashboard size={20} />,
    color: '#2C4A9A',
    bg: '#EAF0FF',
    title: 'Dashboard',
    subtitle: 'O que cada número significa',
    steps: [
      {
        icon: <TrendingUp size={16} />,
        title: 'Cards de KPI',
        desc: 'Total de visitas e positivação média no período selecionado. O R$/Visita é a receita total dividida pelo número de visitas — indica o retorno de cada visita de representante.',
      },
      {
        icon: <Users size={16} />,
        title: 'Comparativo de representantes',
        desc: 'Positivação = % de prescritores visitados que geraram venda no mesmo mês. Cobertura = % da carteira visitada. "Em Risco" = prescritores daquele rep que não compram há mais de 60 dias.',
      },
      {
        icon: <AlertTriangle size={16} />,
        title: 'Categorias de prescritor',
        desc: 'top_roi: alta receita. crescimento: comprando mais mês a mês. risco: caindo ou sumido. reativação: comprou antes, parou, voltou. ativo_médio / ativo_regular: compra consistente em faixas menores. sem_venda: na carteira mas nunca comprou.',
      },
      {
        icon: <TrendingUp size={16} />,
        title: 'Tendência e classe ABC',
        desc: 'A tendência compara os últimos 2 meses com os 2 anteriores. A classe ABC divide a carteira por valor acumulado: A = top 20% da receita, B = próximos 30%, C = restante.',
      },
    ],
    dica: 'Curitiba e Ponta Grossa têm deslocamentos muito diferentes — não compare positivação entre territórios sem considerar isso.',
  },
  {
    id: 'cronograma',
    icon: <Calendar size={20} />,
    color: '#4A7000',
    bg: '#EEF5D6',
    title: 'Cronograma',
    subtitle: 'Geração de visitas e checklist diário',
    steps: [
      {
        icon: <Zap size={16} />,
        title: 'Gerar cronograma',
        desc: 'Escolha mês e ano e clique em "Gerar Cronograma". O sistema distribui as visitas nos dias úteis do mês, priorizando categorias por dia da semana (configurável em Configurações → Parâmetros).',
      },
      {
        icon: <MapPin size={16} />,
        title: 'Agrupamento geográfico',
        desc: 'Se você preencheu cidade e bairro dos prescritores (em Configurações → Localização), o sistema agrupa visitas do mesmo bairro no mesmo dia para reduzir o deslocamento.',
      },
      {
        icon: <ClipboardList size={16} />,
        title: 'Aba Hoje — checklist',
        desc: 'Abre automaticamente mostrando as visitas do dia. Clique em qualquer visita para abrir o painel de registro.',
      },
      {
        icon: <CheckCircle size={16} />,
        title: 'Registrar uma visita',
        desc: 'Ao clicar na visita, um painel abre à direita. Escreva como foi — o que o prescritor comentou, o que pediu, observações relevantes. Clique em "Registrar visita" (ou Ctrl+Enter) para salvar e marcar como realizada.',
      },
    ],
    dica: 'As notas ficam salvas no histórico do prescritor. Na próxima visita, o mesmo painel já mostra tudo que foi registrado antes.',
  },
  {
    id: 'memoria',
    icon: <ClipboardList size={20} />,
    color: '#CC5500',
    bg: '#FFF0E0',
    title: 'Memória dos Prescritores',
    subtitle: 'Banco de notas que cresce com o tempo',
    steps: [
      {
        icon: <ClipboardList size={16} />,
        title: 'O que é',
        desc: 'Cada visita registrada cria uma nota vinculada ao prescritor — com data, quem visitou e o que foi anotado. As notas se acumulam infinitamente e são consultadas sempre que você abre o painel daquele prescritor.',
      },
      {
        icon: <CheckCircle size={16} />,
        title: 'Como usar bem',
        desc: 'Anote o que o prescritor pediu, quais produtos mencionou, datas de próximo contato, objeções, preferências. Quanto mais você registra, mais contexto o representante tem na próxima visita.',
      },
      {
        icon: <MessageSquare size={16} />,
        title: 'Integração com o Agente IA',
        desc: 'O Agente IA também pode consultar padrões de comportamento — quem está em risco, quem cresceu, qual o ROI por visita. Use-o para perguntas analíticas sobre a carteira.',
      },
    ],
    dica: 'Não precisa escrever muito. Até uma frase curta já é útil: "Pediu catálogo do Ômega 3" ou "Viajando até 15/08".',
  },
  {
    id: 'agente',
    icon: <MessageSquare size={20} />,
    color: '#007AB8',
    bg: '#E7F8FF',
    title: 'Agente IA',
    subtitle: 'Perguntas em linguagem natural',
    steps: [
      {
        icon: <MessageSquare size={16} />,
        title: 'O que você pode perguntar',
        desc: 'O Agente responde perguntas sobre os dados importados: "Quem caiu mais esse mês?", "Qual o ROI do João?", "Quais prescritores estão em risco de abandono?", "Como está a positivação da Maria?".',
      },
      {
        icon: <Zap size={16} />,
        title: 'Como funciona',
        desc: 'O Agente interpreta a pergunta, identifica a intenção (ranking, tendência, alerta, comparação) e busca diretamente no banco de dados. Os resultados aparecem em tabelas dentro do chat.',
      },
      {
        icon: <CheckCircle size={16} />,
        title: 'Sugestões automáticas',
        desc: 'Após cada resposta, o Agente sugere perguntas relacionadas para facilitar a exploração. Clique em qualquer sugestão para enviar automaticamente.',
      },
    ],
    dica: 'O Agente funciona melhor com dados de pelo menos 2–3 meses importados. Com mais histórico, as análises de tendência ficam muito mais precisas.',
  },
  {
    id: 'configuracoes',
    icon: <Settings size={20} />,
    color: '#6B7280',
    bg: '#F5F7FA',
    title: 'Configurações',
    subtitle: 'Ajustes do sistema',
    steps: [
      {
        icon: <Users size={16} />,
        title: 'Representantes',
        desc: 'Defina território (Curitiba ou Ponta Grossa), visitas por dia e se está ativo. Representantes marcados como inativos não recebem visitas no cronograma.',
      },
      {
        icon: <MapPin size={16} />,
        title: 'Localização',
        desc: 'Preencha cidade e bairro de cada prescritor. Use a busca para filtrar. Prescritores com localização preenchida aparecem com o badge azul "geo" e são agrupados geograficamente no cronograma.',
      },
      {
        icon: <Settings size={16} />,
        title: 'Parâmetros',
        desc: 'Ajuste os limiares de fuzzy matching, os valores mínimos para cada categoria (top_roi, ativo_médio) e os temas por dia da semana. Os temas definem qual categoria de prescritor é priorizada em cada dia.',
      },
    ],
    dica: 'A lista de exclusões de vendas evita que nomes como "SITE", "CNPJ" ou "SEM INDICAÇÃO" entrem como prescritores. Adicione qualquer nome que aparece nos seus arquivos e não é um prescritor real.',
  },
]

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={CARD} className="overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: section.bg, color: section.color }}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{section.title}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{section.subtitle}</p>
        </div>
        <div style={{ color: '#D1D5DB' }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {open && (
        <div className="px-6 pb-5" style={{ borderTop: '1px solid #F5F7FA' }}>
          <div className="space-y-4 mt-4">
            {section.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 flex items-start gap-2.5 mt-0.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: section.bg, color: section.color }}
                  >
                    {i + 1}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: section.color }}>{step.icon}</span>
                    <p className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{step.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {section.dica && (
            <div className="mt-5 flex gap-3 rounded-xl px-4 py-3" style={{ background: section.bg, border: `1px solid ${section.color}22` }}>
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-sm" style={{ color: section.color }}>{section.dica}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Tutorial() {
  const [todos, setTodos] = useState(false)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>Tutorial</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Como usar cada parte da plataforma</p>
        </div>
        <button
          onClick={() => setTodos(o => !o)}
          className="text-sm px-3 py-2 rounded-lg transition-colors"
          style={{ border: '1px solid #E8E8E8', color: '#6B7280', background: '#fff' }}
        >
          {todos ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>

      {/* Fluxo rápido */}
      <div style={{ ...CARD, background: '#2C4A9A' }} className="p-5">
        <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>FLUXO BÁSICO — do zero ao cronograma</p>
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { icon: <UploadCloud size={14} />, label: 'Importar .xlsx' },
            { icon: <CheckCircle size={14} />, label: 'Revisar matches' },
            { icon: <Settings size={14} />, label: 'Configurar reps' },
            { icon: <MapPin size={14} />, label: 'Adicionar localização' },
            { icon: <Calendar size={14} />, label: 'Gerar cronograma' },
            { icon: <ClipboardList size={14} />, label: 'Registrar visitas' },
          ].map((item, i, arr) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              {i < arr.length - 1 && (
                <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Seções */}
      <div className="space-y-3">
        {SECTIONS.map(s => (
          <ExpandableSection key={s.id} section={s} forceOpen={todos} />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-6" style={{ borderTop: '1px solid #F0F0F0' }}>
        <BookOpen size={24} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Dúvidas? Use o <strong style={{ color: '#2C4A9A' }}>Agente IA</strong> — ele responde perguntas sobre os dados em tempo real.</p>
      </div>
    </div>
  )
}

function ExpandableSection({ section, forceOpen }: { section: Section; forceOpen: boolean }) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = forceOpen || localOpen

  return (
    <div style={CARD} className="overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
        onClick={() => setLocalOpen(o => !o)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: section.bg, color: section.color }}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{section.title}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{section.subtitle}</p>
        </div>
        <div style={{ color: '#D1D5DB' }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {open && (
        <div className="px-6 pb-5" style={{ borderTop: '1px solid #F5F7FA' }}>
          <div className="space-y-4 mt-4">
            {section.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: section.bg, color: section.color }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: section.color }}>{step.icon}</span>
                    <p className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{step.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {section.dica && (
            <div className="mt-5 flex gap-3 rounded-xl px-4 py-3" style={{ background: section.bg, border: `1px solid ${section.color}33` }}>
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-sm" style={{ color: section.color }}>{section.dica}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
