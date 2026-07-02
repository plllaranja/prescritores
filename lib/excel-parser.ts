import * as XLSX from 'xlsx'
import { getConfigJSON } from './db'

const MES_MAP: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

function removeDiacritics(str: string) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function parseMesAnoFromFilename(filename: string): { mes: number; ano: number } | null {
  // Padrões: Prescrições_out_2025.xlsx, Prescrições_outubro_2025.xlsx
  const clean = removeDiacritics(filename.toLowerCase())
  const match = clean.match(/[_\-\s]([a-z]+)[_\-\s](\d{4})/)
  if (!match) return null
  const mesStr = match[1]
  const ano = parseInt(match[2])
  const mes = MES_MAP[mesStr]
  if (!mes || isNaN(ano)) return null
  return { mes, ano }
}

function normalizeNome(nome: string): string {
  return nome
    .toUpperCase()
    .replace(/\bDR\.?\s*/g, '')
    .replace(/\bDRA\.?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHospital(nome: string): boolean {
  const termos = getConfigJSON<string[]>('termos_hospital', ['HOSPITAL', 'SANTA CASA'])
  const upper = nome.toUpperCase()
  return termos.some(t => upper.includes(t.toUpperCase()))
}

function isExcluido(nome: string): boolean {
  if (!nome || !nome.trim()) return true
  const exclusoes = getConfigJSON<string[]>('exclusoes_vendas', [
    'CNPJ', 'SITE', 'SEM INDICAÇÃO DE NUTRICIONISTA', 'PÓS VENDA', 'TECWORKS', 'INDICAÇÃO DO VENDEDOR'
  ])
  const upper = removeDiacritics(nome.toUpperCase().trim())
  return exclusoes.some(e => removeDiacritics(e.toUpperCase()) === upper)
}

export interface VendaRow {
  nome_original: string
  nome_normalizado: string
  tipo_entidade: 'pessoa_fisica' | 'hospital'
  qtd_vendas: number
  valor_total: number
  qtd_itens: number
  margem_pct: number | null
  ticket_medio: number | null
}

export function parseVendas(buffer: Buffer): VendaRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

  const result: VendaRow[] = []
  for (const row of rows as unknown[][]) {
    const nome = String(row[0] ?? '').trim()
    if (!nome || isExcluido(nome)) continue

    // Pular linhas de cabeçalho (primeira coluna não é um nome real)
    if (/nutricionista|prescritor|nome|header/i.test(nome)) continue

    const qtd_vendas = Number(row[1]) || 0
    const valor_total = Number(row[2]) || 0
    const qtd_itens = Number(row[3]) || 0
    const margem_pct = row[4] != null ? Number(row[4]) : null
    const ticket_medio = row[5] != null ? Number(row[5]) : null

    if (qtd_vendas === 0 && valor_total === 0) continue

    result.push({
      nome_original: nome,
      nome_normalizado: normalizeNome(nome),
      tipo_entidade: isHospital(nome) ? 'hospital' : 'pessoa_fisica',
      qtd_vendas,
      valor_total,
      qtd_itens,
      margem_pct,
      ticket_medio,
    })
  }
  return result
}

export interface VisitaRow {
  id_original: string
  data_visita: string
  nome_cliente_bruto: string
  nome_normalizado: string
  especialidade: string
  proximo_contato: string | null
  ultimo_contato: string | null
  status: string
  observacoes: string
  representante_nome: string
}

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${d.y}-${mm}-${dd}`
  }
  const str = String(val).trim()
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return str || null
}

export function parseVisitas(buffers: Buffer[]): VisitaRow[] {
  const result: VisitaRow[] = []
  for (const buffer of buffers) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

    for (const row of rows as unknown[][]) {
      const id_original = String(row[0] ?? '').trim()
      // Só processa linhas onde a primeira coluna começa com #
      if (!id_original.startsWith('#')) continue

      const data_visita = parseDate(row[1])
      if (!data_visita) continue

      const nome_cliente_bruto = String(row[3] ?? '').trim()
      if (!nome_cliente_bruto) continue

      const responsavel_raw = String(row[9] ?? '').trim()
      const representante_nome = responsavel_raw.includes('/')
        ? responsavel_raw.split('/')[0].trim()
        : responsavel_raw.trim()

      result.push({
        id_original,
        data_visita,
        nome_cliente_bruto,
        nome_normalizado: normalizeNome(nome_cliente_bruto),
        especialidade: String(row[4] ?? '').trim(),
        proximo_contato: parseDate(row[5]),
        ultimo_contato: parseDate(row[6]),
        status: String(row[7] ?? '').trim() || 'Realizada',
        observacoes: String(row[8] ?? '').trim(),
        representante_nome,
      })
    }
  }
  return result
}

export function detectFileType(filename: string): 'vendas' | 'visitas' | 'unknown' {
  const lower = filename.toLowerCase()
  if (lower.includes('prescri') || lower.includes('vend')) return 'vendas'
  if (lower.includes('visita') || lower.includes('relatorio')) return 'visitas'
  return 'unknown'
}
