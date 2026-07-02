'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UploadCloud, LayoutDashboard, MessageSquare, Calendar, Settings, Activity } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/importacao', label: 'Importação', icon: UploadCloud },
  { href: '/agente', label: 'Agente', icon: MessageSquare },
  { href: '/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-400" size={22} />
          <span className="font-semibold text-white text-lg">Prescritores</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Painel Comercial</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">v1.0 · Local</p>
      </div>
    </aside>
  )
}
