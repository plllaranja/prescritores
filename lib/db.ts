import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'data.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descricao TEXT
    );

    CREATE TABLE IF NOT EXISTS representantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      territorio TEXT CHECK(territorio IN ('Curitiba','Ponta Grossa')) ,
      visitas_por_dia INTEGER DEFAULT 6,
      ativo INTEGER DEFAULT 1,
      pendente_configuracao INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prescritores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_canonico TEXT NOT NULL UNIQUE,
      tipo_entidade TEXT DEFAULT 'pessoa_fisica' CHECK(tipo_entidade IN ('pessoa_fisica','hospital')),
      especialidade TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prescritor_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescritor_id INTEGER REFERENCES prescritores(id) ON DELETE CASCADE,
      nome_variante TEXT NOT NULL,
      origem TEXT CHECK(origem IN ('visita','venda','manual')),
      confirmado INTEGER DEFAULT 0,
      UNIQUE(nome_variante)
    );

    CREATE TABLE IF NOT EXISTS vendas_mensais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescritor_id INTEGER REFERENCES prescritores(id) ON DELETE CASCADE,
      mes INTEGER NOT NULL,
      ano INTEGER NOT NULL,
      qtd_vendas INTEGER DEFAULT 0,
      valor_total REAL DEFAULT 0,
      qtd_itens INTEGER DEFAULT 0,
      margem_pct REAL,
      ticket_medio REAL,
      upload_id INTEGER,
      UNIQUE(prescritor_id, mes, ano)
    );

    CREATE TABLE IF NOT EXISTS visitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescritor_id INTEGER REFERENCES prescritores(id),
      nome_cliente_bruto TEXT NOT NULL,
      data_visita TEXT NOT NULL,
      representante_id INTEGER REFERENCES representantes(id),
      especialidade TEXT,
      status TEXT DEFAULT 'Realizada',
      observacoes TEXT,
      proximo_contato TEXT,
      ultimo_contato TEXT,
      match_score REAL,
      match_confirmado INTEGER DEFAULT 0,
      upload_id INTEGER,
      id_original TEXT
    );

    CREATE TABLE IF NOT EXISTS matches_pendentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_visita TEXT NOT NULL,
      nome_candidato TEXT NOT NULL,
      score REAL NOT NULL,
      upload_id INTEGER,
      resolvido INTEGER DEFAULT 0,
      resolucao TEXT CHECK(resolucao IN ('confirmado','rejeitado','manual')),
      prescritor_id_escolhido INTEGER REFERENCES prescritores(id),
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploads_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo_nome TEXT NOT NULL,
      tipo TEXT CHECK(tipo IN ('visitas','vendas')),
      mes INTEGER,
      ano INTEGER,
      data_upload TEXT DEFAULT (datetime('now')),
      linhas_importadas INTEGER DEFAULT 0,
      linhas_ignoradas INTEGER DEFAULT 0,
      linhas_com_erro INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ok'
    );

    CREATE TABLE IF NOT EXISTS cronograma (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      representante_id INTEGER REFERENCES representantes(id),
      data TEXT NOT NULL,
      prescritor_id INTEGER REFERENCES prescritores(id),
      categoria_prioridade TEXT,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','realizada','cancelada','reagendada')),
      observacoes TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );
  `)

  // Seed configurações padrão
  const cfgInsert = db.prepare(`
    INSERT OR IGNORE INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)
  `)
  const defaults: [string, string, string][] = [
    ['exclusoes_vendas', JSON.stringify(['CNPJ','SITE','SEM INDICAÇÃO DE NUTRICIONISTA','SEM INDICACAO DE NUTRICIONISTA','PÓS VENDA','POS VENDA','TECWORKS','INDICAÇÃO DO VENDEDOR','INDICACAO DO VENDEDOR']), 'Nomes a excluir da planilha de vendas'],
    ['termos_hospital', JSON.stringify(['HOSPITAL','SANTA CASA']), 'Termos que identificam uma entidade como hospital'],
    ['fuzzy_score_auto', '85', 'Score mínimo para aceitar match automaticamente'],
    ['fuzzy_score_revisao', '70', 'Score mínimo para match incerto (revisão manual)'],
    ['dias_sem_visita_alerta', '60', 'Dias sem visita para alertar risco de abandono'],
    ['valor_top_roi', '15000', 'Valor mínimo para categoria top_roi'],
    ['valor_ativo_medio', '5000', 'Valor mínimo para categoria ativo_medio'],
    ['meses_top_roi', '2', 'Meses mínimos com venda para top_roi'],
    ['tema_segunda', 'top_roi', 'Categoria prioritária na segunda-feira'],
    ['tema_terca', 'reativacao,risco', 'Categorias prioritárias na terça-feira'],
    ['tema_quarta', 'crescimento,ativo_medio', 'Categorias prioritárias na quarta-feira'],
    ['tema_quinta', 'ativo_regular', 'Categoria prioritária na quinta-feira'],
    ['tema_sexta', 'pontual,sem_venda', 'Categorias prioritárias na sexta-feira'],
  ]
  for (const row of defaults) cfgInsert.run(...row)
}

export function getConfig(chave: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave) as { valor: string } | undefined
  return row?.valor ?? null
}

export function getConfigJSON<T>(chave: string, fallback: T): T {
  const val = getConfig(chave)
  if (!val) return fallback
  try { return JSON.parse(val) as T } catch { return fallback }
}

export function setConfig(chave: string, valor: string) {
  getDb().prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor)
}
