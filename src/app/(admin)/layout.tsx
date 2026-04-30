'use client'

import { useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kasir', label: 'Kasir', icon: Receipt },
  { href: '/transactions', label: 'Transaksi', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
]

// Mobile bottom nav
const MOBILE_NAV = NAV_ITEMS

// ── Idle timeout: 30 minutes ─────────────────────────────────────────────
const TIMEOUT_MS = 30 * 60 * 1000

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // ── Perform logout ─────────────────────────────────────────────────────
  const performLogout = useCallback(async () => {
    document.cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; path=/`
    logout()
    router.push('/login')
  }, [logout, router])

  // ── Idle timeout ──────────────────────────────────────────────────────
  useEffect(() => {
    let last = Date.now()
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const reset = () => { last = Date.now() }
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))

    const interval = setInterval(() => {
      if (Date.now() - last > TIMEOUT_MS) {
        performLogout()
      }
    }, 60_000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      clearInterval(interval)
    }
  }, [performLogout])

  // ── Sidebar item ───────────────────────────────────────────────────────
  const NavItem = ({ href, label, icon: Icon, isCollapsed }: { href: string; label: string; icon: any; isCollapsed?: boolean }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`)
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors group',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        title={isCollapsed ? label : undefined}
      >
        <Icon className={cn("shrink-0", isCollapsed ? "w-5 h-5 mx-auto" : "w-4 h-4")} />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    )
  }

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className={cn("flex items-center border-b border-sidebar-border py-4", isCollapsed ? "justify-center px-0" : "px-4 gap-3")}>
        <div className="bg-primary p-2 rounded-lg shrink-0">
          <Car className="w-5 h-5 text-primary-foreground" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sidebar-foreground text-sm truncate">
              {process.env.NEXT_PUBLIC_APP_NAME ?? 'CarWash'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Panel Admin</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground text-xs font-bold truncate">{user?.name}</p>
              <p className="text-muted-foreground text-xs truncate">Admin</p>
            </div>
          </div>
        )}
        <button
          onClick={performLogout}
          className={cn(
            "flex items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
            isCollapsed ? "justify-center p-2 mx-auto w-10" : "w-full px-3 py-2"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && "Logout"}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar (lg+) */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 z-40">
        <SidebarContent />
      </aside>

      {/* Tablet Collapsed Sidebar (md to lg) */}
      <aside className="hidden md:block lg:hidden w-20 shrink-0 fixed inset-y-0 z-40">
        <SidebarContent isCollapsed />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen w-full md:pl-20 lg:pl-64 pb-16 md:pb-0">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
          <div className="bg-primary p-1.5 rounded-lg">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-foreground leading-tight truncate">
              {process.env.NEXT_PUBLIC_APP_NAME ?? 'CarWash'}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Panel Admin</p>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center gap-3 px-4 lg:px-6 py-3 bg-card border-b border-border sticky top-0 z-30">
          <div className="bg-primary p-1.5 rounded-lg">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-foreground leading-tight">
              {process.env.NEXT_PUBLIC_APP_NAME ?? 'CarWash'}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Panel Admin</p>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-between px-2 pb-safe pt-1 z-40">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 px-1 text-[10px] font-medium transition-all duration-200',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-200",
                active ? "bg-primary/10" : ""
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}