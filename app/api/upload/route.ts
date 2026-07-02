import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseVendas, parseVisitas, parseMesAnoFromFilename, detectFileType } from '@/lib/excel-parser'
import { matchVisitasComPrescritores, reprocessarMatchesPendentes } from '@/lib/fuzzy-matcher'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  const db = getDb()
  const relatorio: {
    arquivo: string; tipo: string; mes?: number; ano?: number;
    linhas: number; ignoradas: number; erros: number; status: string; mensagem?: string
  }[] = []

  const vendaFiles: { file: File; buffer: Buffer; mes: number; ano: number }[] = []
  const visitaFiles: { file: File; buffer: Buffer }[] = []

  // Classificar arquivos
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const tipo = detectFileType(file.name)

    if (tipo === 'vendas') {
      const mesAno = parseMesAnoFromFilename(file.name)
      if (!mesAno) {
        relatorio.push({ arquivo: file.name, tipo: 'vendas', linhas: 0, ignoradas: 0, erros: 1, status: 'erro', mensagem: 'Não foi possível extrair mês/ano do nome do arquivo' })
        continue
      }
      vendaFiles.push({ file, buffer, ...mesAno })
    } else if (tipo === 'visitas') {
      visitaFiles.push({ file, buffer })
    } else {
      relatorio.push({ arquivo: file.name, tipo: 'desconhecido', linhas: 0, ignoradas: 0, erros: 0, status: 'ignorado', mensagem: 'Tipo de arquivo não reconhecido' })
    }
  }

  // Processar vendas
  for (const { file, buffer, mes, ano } of vendaFiles) {
    const existente = db.prepare('SELECT id FROM uploads_log WHERE tipo = ? AND mes = ? AND ano = ?').get('vendas', mes, ano)
    if (existente) {
      relatorio.push({ arquivo: file.name, tipo: 'vendas', mes, ano, linhas: 0, ignoradas: 0, erros: 0, status: 'ja_existe', mensagem: `Mês ${mes}/${ano} já importado. Use a opção de substituir para reimportar.` })
      continue
    }

    try {
      const rows = parseVendas(buffer)
      const uploadLog = db.prepare(`
        INSERT INTO uploads_log (arquivo_nome, tipo, mes, ano, linhas_importadas) VALUES (?, 'vendas', ?, ?, ?)
      `).run(file.name, mes, ano, rows.length)
      const uploadId = uploadLog.lastInsertRowid as number

      const insertPresc = db.prepare(`INSERT OR IGNORE INTO prescritores (nome_canonico, tipo_entidade) VALUES (?, ?)`)
      const insertVenda = db.prepare(`
        INSERT OR REPLACE INTO vendas_mensais (prescritor_id, mes, ano, qtd_vendas, valor_total, qtd_itens, margem_pct, ticket_medio, upload_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const insertAlias = db.prepare(`INSERT OR IGNORE INTO prescritor_aliases (prescritor_id, nome_variante, origem, confirmado) VALUES (?, ?, 'venda', 1)`)

      const txn = db.transaction(() => {
        for (const row of rows) {
          insertPresc.run(row.nome_normalizado, row.tipo_entidade)
          const p = db.prepare('SELECT id FROM prescritores WHERE nome_canonico = ?').get(row.nome_normalizado) as { id: number }
          if (!p) continue
          // Atualizar tipo_entidade se necessário
          db.prepare('UPDATE prescritores SET tipo_entidade = ? WHERE id = ?').run(row.tipo_entidade, p.id)
          insertVenda.run(p.id, mes, ano, row.qtd_vendas, row.valor_total, row.qtd_itens, row.margem_pct, row.ticket_medio, uploadId)
          if (row.nome_original !== row.nome_normalizado) {
            insertAlias.run(p.id, row.nome_original)
          }
        }
      })
      txn()

      // Rematching retroativo
      reprocessarMatchesPendentes()

      relatorio.push({ arquivo: file.name, tipo: 'vendas', mes, ano, linhas: rows.length, ignoradas: 0, erros: 0, status: 'ok' })
    } catch (e) {
      relatorio.push({ arquivo: file.name, tipo: 'vendas', mes, ano, linhas: 0, ignoradas: 0, erros: 1, status: 'erro', mensagem: String(e) })
    }
  }

  // Processar visitas (todos juntos)
  if (visitaFiles.length > 0) {
    try {
      const buffers = visitaFiles.map(f => f.buffer)
      const rows = parseVisitas(buffers)

      // Detectar mês/ano das visitas pelo campo data_visita
      const meses = new Map<string, { mes: number; ano: number; count: number }>()
      for (const row of rows) {
        const d = row.data_visita
        const [ano, mes] = [parseInt(d.slice(0,4)), parseInt(d.slice(5,7))]
        const key = `${mes}/${ano}`
        meses.set(key, { mes, ano, count: (meses.get(key)?.count ?? 0) + 1 })
      }

      const nomeArquivos = visitaFiles.map(f => f.file.name).join(', ')
      const uploadLog = db.prepare(`INSERT INTO uploads_log (arquivo_nome, tipo, linhas_importadas) VALUES (?, 'visitas', ?)`).run(nomeArquivos, rows.length)
      const uploadId = uploadLog.lastInsertRowid as number

      // Garantir representantes existem
      const insertRep = db.prepare(`INSERT OR IGNORE INTO representantes (nome, pendente_configuracao) VALUES (?, 1)`)

      const nomesVisita = rows.map(r => r.nome_cliente_bruto)
      const matchResults = matchVisitasComPrescritores(nomesVisita, uploadId as number)
      const matchMap = new Map(matchResults.map(m => [m.nome_visita, m]))

      const insertVisita = db.prepare(`
        INSERT INTO visitas (prescritor_id, nome_cliente_bruto, data_visita, representante_id, especialidade,
          status, observacoes, proximo_contato, ultimo_contato, match_score, match_confirmado, upload_id, id_original)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const txn = db.transaction(() => {
        for (const row of rows) {
          if (row.representante_nome) {
            insertRep.run(row.representante_nome)
          }
          const rep = row.representante_nome
            ? db.prepare('SELECT id FROM representantes WHERE nome = ?').get(row.representante_nome) as { id: number } | undefined
            : undefined

          const match = matchMap.get(row.nome_cliente_bruto)
          const prescId = match && match.tipo === 'automatico' ? match.prescritor_id : null
          const matchScore = match?.score ?? null
          const matchConfirmado = match?.tipo === 'automatico' ? 1 : 0

          insertVisita.run(
            prescId, row.nome_cliente_bruto, row.data_visita, rep?.id ?? null,
            row.especialidade, row.status, row.observacoes,
            row.proximo_contato, row.ultimo_contato,
            matchScore, matchConfirmado, uploadId, row.id_original
          )
        }
      })
      txn()

      const automaticos = matchResults.filter(m => m.tipo === 'automatico').length
      const revisao = matchResults.filter(m => m.tipo === 'revisao').length
      const naoAssociados = matchResults.filter(m => m.tipo === 'nao_associado').length

      for (const vf of visitaFiles) {
        relatorio.push({
          arquivo: vf.file.name, tipo: 'visitas', linhas: rows.length,
          ignoradas: 0, erros: 0, status: 'ok',
          mensagem: `${automaticos} matches automáticos, ${revisao} para revisão, ${naoAssociados} não associados`
        })
      }
    } catch (e) {
      for (const vf of visitaFiles) {
        relatorio.push({ arquivo: vf.file.name, tipo: 'visitas', linhas: 0, ignoradas: 0, erros: 1, status: 'erro', mensagem: String(e) })
      }
    }
  }

  return NextResponse.json({ relatorio })
}

// Substituir mês (reimportar)
export async function DELETE(req: NextRequest) {
  const { tipo, mes, ano } = await req.json()
  const db = getDb()

  if (tipo === 'vendas') {
    db.prepare('DELETE FROM vendas_mensais WHERE mes = ? AND ano = ?').run(mes, ano)
    db.prepare('DELETE FROM uploads_log WHERE tipo = ? AND mes = ? AND ano = ?').run('vendas', mes, ano)
  } else {
    db.prepare(`
      DELETE FROM visitas WHERE upload_id IN (
        SELECT id FROM uploads_log WHERE tipo = 'visitas' AND mes = ? AND ano = ?
      )
    `).run(mes, ano)
    db.prepare('DELETE FROM uploads_log WHERE tipo = ? AND mes = ? AND ano = ?').run('visitas', mes, ano)
  }

  return NextResponse.json({ ok: true })
}
