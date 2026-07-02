import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const logs = db.prepare(`
    SELECT id, arquivo_nome, tipo, mes, ano, data_upload, linhas_importadas, linhas_ignoradas, linhas_com_erro, status
    FROM uploads_log ORDER BY data_upload DESC LIMIT 100
  `).all()
  return NextResponse.json(logs)
}
