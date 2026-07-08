import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Le Farma · Prescritores',
  description: 'Painel comercial de acompanhamento de prescritores',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={poppins.variable} style={{ fontFamily: 'var(--font-poppins, Poppins, sans-serif)', background: '#F5F7FA', color: '#1A1A2E', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
