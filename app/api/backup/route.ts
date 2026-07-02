import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const db = getDb()
  // Exportar todas as tabelas como JSON
  const tabelas = ['representantes','prescritores','prescritor_aliases','vendas_mensais','visitas','uploads_log','cronograma','configuracoes']
  const backup: Record<string, unknown[]> = {}
  for (const t of tabelas) {
    backup[t] = db.prepare(`SELECT * FROM ${t}`).all()
  }
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup_${new Date().toISOString().slice(0,10)}.json"`,
    }
  })
}
