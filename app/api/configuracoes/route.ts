import { NextRequest, NextResponse } from 'next/server'
import { getDb, getConfig, setConfig } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const configs = db.prepare('SELECT chave, valor, descricao FROM configuracoes ORDER BY chave').all()
  return NextResponse.json(configs)
}

export async function PUT(req: NextRequest) {
  const updates = await req.json() as Array<{ chave: string; valor: string }>
  for (const { chave, valor } of updates) {
    setConfig(chave, valor)
  }
  return NextResponse.json({ ok: true })
}
