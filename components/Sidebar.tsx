'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UploadCloud, LayoutDashboard, MessageSquare, Calendar, Settings, BookOpen, LogOut, Shield, FileBarChart } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/importacao', label: 'Importação', icon: UploadCloud },
  { href: '/agente', label: 'Agente IA', icon: MessageSquare },
  { href: '/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/relatorio', label: 'Relatório', icon: FileBarChart },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

const linksBottom = [
  { href: '/tutorial', label: 'Tutorial', icon: BookOpen },
]

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <aside
        className="lf-sidebar fixed left-0 top-0 h-screen flex flex-col z-40"
        style={{ width: 220, background: '#2C4A9A' }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm" style={{ background: '#FFCB00', color: '#2C4A9A' }}>
              LF
            </div>
            <div>
              <p className="font-semibold text-white text-sm leading-tight">Le Farma</p>
              <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>Prescritores</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                style={active
                  ? { borderLeft: '3px solid #FFCB00', paddingLeft: 10, color: '#FFCB00', background: 'rgba(255,255,255,0.1)' }
                  : { borderLeft: '3px solid transparent', paddingLeft: 10, color: 'rgba(255,255,255,0.65)' }
                }
                className="flex items-center gap-3 py-2.5 pr-3 rounded-r-lg text-sm transition-all hover:bg-white/5"
              >
                <Icon size={16} />
                <span className={active ? 'font-semibold' : 'font-normal'}>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, paddingBottom: 8 }}>
          {linksBottom.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                style={active
                  ? { borderLeft: '3px solid #FFCB00', paddingLeft: 10, color: '#FFCB00', background: 'rgba(255,255,255,0.1)' }
                  : { borderLeft: '3px solid transparent', paddingLeft: 10, color: 'rgba(255,255,255,0.45)' }
                }
                className="flex items-center gap-3 py-2 pr-3 rounded-r-lg text-sm transition-all hover:bg-white/5"
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            )
          })}

          {/* User info + logout */}
          <div className="mt-2 px-2 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#FFCB00', color: '#2C4A9A' }}>
                {user.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.nome}</p>
                <div className="flex items-center gap-1">
                  {user.role === 'admin' && <Shield size={10} style={{ color: '#FFCB00' }} />}
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.role === 'admin' ? 'Admin' : 'Representante'}</p>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <LogOut size={12} /> Sair
            </button>
          </div>
        </div>
      </aside>

      <nav className="lf-mobile-nav fixed bottom-0 left-0 right-0 z-50 hidden" style={{ background: '#2C4A9A', boxShadow: '0 -8px 24px rgba(0,0,0,0.14)' }}>
        <div className="grid grid-cols-6">
          {[...links, ...linksBottom].map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-1 py-2 min-w-0"
                style={active ? { color: '#FFCB00' } : { color: 'rgba(255,255,255,0.68)' }}
                aria-label={label}
              >
                <Icon size={18} />
                <span className="text-[10px] leading-none truncate max-w-full px-1">{label.replace('ConfiguraÃ§Ãµes', 'Config.')}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
