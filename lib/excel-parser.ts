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

// Converte número em formato BR ("4.424,33") ou US ("4424.33") para float
function parseBRNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (val == null || val === '') return 0
  const str = String(val).trim().replace(/[R$\s]/g, '')
  if (!str) return 0
  // Formato BR: ponto como milhar, vírgula como decimal → "4.424,33"
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(str)) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Só vírgula como decimal → "144,24"
  if (/^\d+(,\d+)$/.test(str)) {
    return parseFloat(str.replace(',', '.')) || 0
  }
  return parseFloat(str) || 0
}

export function parseMesAnoFromFilename(filename: string): { mes: number; ano: number } | null {
  const clean = removeDiacritics(filename.toLowerCase().replace(/\.xlsx?$/i, ''))

  // Padrão 1: separado por _ - ou espaço com ano 4 dígitos: prescrições_out_2025, junho 2025
  const m1 = clean.match(/[_\-\s]([a-z]+)[_\-\s](\d{4})/)
  if (m1) {
    const mes = MES_MAP[m1[1]]; const ano = parseInt(m1[2])
    if (mes && !isNaN(ano)) return { mes, ano }
  }

  // Padrão 2: nome_mes_ano2dig: "junho 26", "maio 26" (ano 2 dígitos)
  const m2 = clean.match(/([a-z]+)[_\-\s](\d{2})$/)
  if (m2) {
    const mes = MES_MAP[m2[1]]; const anoShort = parseInt(m2[2])
    if (mes && !isNaN(anoShort)) return { mes, ano: 2000 + anoShort }
  }

  // Padrão 3: começa com o mês por extenso: "junho 26.xlsx", "março_2025"
  const m3 = clean.match(/^([a-z]+)[_\-\s](\d{2,4})/)
  if (m3) {
    const mes = MES_MAP[m3[1]]; const anoRaw = parseInt(m3[2])
    if (mes && !isNaN(anoRaw)) return { mes, ano: anoRaw < 100 ? 2000 + anoRaw : anoRaw }
  }

  // Padrão 4: mês em qualquer posição sem separador obrigatório: "vendas_junho_26"
  for (const [nome, num] of Object.entries(MES_MAP)) {
    const re = new RegExp(`${nome}[_\\-\\s]?(\\d{2,4})`)
    const m = clean.match(re)
    if (m) {
      const anoRaw = parseInt(m[1])
      return { mes: num, ano: anoRaw < 100 ? 2000 + anoRaw : anoRaw }
    }
  }

  return null
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

// Detecta índices das colunas pelo cabeçalho
function detectarColunas(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const h = removeDiacritics(String(headerRow[i] ?? '').toLowerCase().trim())
    if (/nutricionista|prescritor|nome|medico|medica/.test(h)) map.nome = i
    else if (/qtd.*vend|quantidade.*vend|qnt.*vend/.test(h)) map.qtd_vendas = i
    else if (/valor.*vend|receita|faturamento|vl.*vend/.test(h)) map.valor_total = i
    else if (/qtd.*item|quantidade.*item|qnt.*item/.test(h)) map.qtd_itens = i
    else if (/margem/.test(h)) map.margem_pct = i
    else if (/tkt|ticket/.test(h)) map.ticket_medio = i
  }
  return map
}

export function parseVendas(buffer: Buffer): VendaRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][]

  if (rows.length === 0) return []

  // Encontrar linha de cabeçalho (primeira com texto reconhecível)
  let headerIdx = 0
  let cols: Record<string, number> = {}
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const detected = detectarColunas(rows[i] as unknown[])
    if (detected.nome !== undefined && detected.valor_total !== undefined) {
      headerIdx = i; cols = detected; break
    }
    // Fallback: tenta formato legado (nome na col 0)
    if (detected.qtd_vendas !== undefined || detected.valor_total !== undefined) {
      headerIdx = i; cols = detected; break
    }
  }

  // Se não detectou pelo cabeçalho, usa posições padrão do formato Le Farma:
  // Código(0) | data(1) | Nutricionista(2) | Qtd.Vendas(3) | Valor Vendas(4) | Preço Custo(5) | Lucro(6) | Qtd.Itens(7) | Margem(8) | Tkt.Médio(9) | P/A(10)
  if (cols.nome === undefined) {
    cols = { nome: 2, qtd_vendas: 3, valor_total: 4, qtd_itens: 7, margem_pct: 8, ticket_medio: 9 }
  }

  const result: VendaRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const nome = String(row[cols.nome] ?? '').trim()
    if (!nome || isExcluido(nome)) continue
    if (/nutricionista|prescritor|nome|header|codigo|data/i.test(nome)) continue

    const qtd_vendas  = parseBRNumber(row[cols.qtd_vendas])
    const valor_total = parseBRNumber(row[cols.valor_total])
    const qtd_itens   = parseBRNumber(row[cols.qtd_itens])
    const margem_pct  = cols.margem_pct  != null && row[cols.margem_pct]  != null ? parseBRNumber(row[cols.margem_pct])  : null
    const ticket_medio= cols.ticket_medio != null && row[cols.ticket_medio] != null ? parseBRNumber(row[cols.ticket_medio]) : null

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
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const str = String(val).trim()
  // DD/MM/YYYY ou DD/MM/YYYY HH:MM ou DD/MM/YYYY HH:MM:SS
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // YYYY-MM-DD (já no formato certo)
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  // MM/DD/YYYY (formato americano)
  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m3) return `${m3[3]}-${m3[1].padStart(2,'0')}-${m3[2].padStart(2,'0')}`
  return null
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
  const lower = removeDiacritics(filename.toLowerCase())
  if (lower.includes('prescri') || lower.includes('vend')) return 'vendas'
  if (lower.includes('visita') || lower.includes('relatorio')) return 'visitas'
  // Se o nome contém um mês por extenso + ano, trata como vendas (padrão "junho 26.xlsx")
  const mesesNomes = Object.keys(MES_MAP)
  if (mesesNomes.some(m => lower.includes(m)) && /\d{2,4}/.test(lower)) return 'vendas'
  return 'unknown'
}
