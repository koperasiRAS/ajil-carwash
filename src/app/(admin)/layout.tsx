'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Tag,
  Users,
  Clock,
  Package,
  Wallet,
  Shield,
  Settings,
  LogOut,
  Car,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transaksi', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/services', label: 'Layanan', icon: Tag },
  { href: '/employees', label: 'Karyawan', icon: Users },
  { href: '/shifts', label: 'Shift', icon: Clock },
  { href: '/stock', label: 'Stok', icon: Package },
  { href: '/expenses', label: 'Pengeluaran', icon: Wallet },
  { href: '/audit-logs', label: 'Audit Log', icon: Shield },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
]

// Top 5 items for mobile bottom nav
const MOBILE_NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transaksi', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/employees', label: 'Karyawan', icon: Users },
  { href: '/settings', label: 'Setting', icon: Settings },
]

// --- Idle timeout constants ---
const TIMEOUT_MS = 30 * 60 * 1000

interface ShiftSummary {
  totalTx: number
  totalOmzet: number
  motorCount: number
  mobilCount: number
  pickupCount: number
  trukCount: number
  cashTotal: number
  expectedCash: number
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, activeShiftId, logout } = useAuthStore()
  const supabase = createClient()

  // --- Close shift modal state ---
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [closingCash, setClosingCash] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [closing, setClosing] = useState(false)
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null)
  const [closeError, setCloseError] = useState('')

  // --- Perform logout callback ---
  const performLogout = useCallback(async () => {
    if (activeShiftId) {
      await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShiftId,
          actualCash: 0,
          note: 'Auto logout - session timeout',
        }),
      }).catch(() => {})
    }
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }, [activeShiftId, supabase, logout, router])

  // --- Idle timeout effect ---
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
  }, [activeShiftId, performLogout])

  // --- Shift summary fetch ---
  async function openCloseShiftModal() {
    if (!activeShiftId) return
    setShowCloseShift(true)
    const { data: txList } = await supabase
      .from('transactions')
      .select('total, payment_method, vehicle_type')
      .eq('shift_id', activeShiftId)
      .eq('status', 'COMPLETED')

    const txList_ = txList ?? []
    const totalOmzet = txList_.reduce((s, t) => s + t.total, 0)
    const cashTotal = txList_.filter((t) => t.payment_method === 'CASH').reduce((s, t) => s + t.total, 0)
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('opening_cash')
      .eq('id', activeShiftId)
      .single()

    setShiftSummary({
      totalTx: txList_.length,
      totalOmzet,
      motorCount: txList_.filter((t) => t.vehicle_type === 'MOTOR').length,
      mobilCount: txList_.filter((t) => t.vehicle_type === 'MOBIL').length,
      pickupCount: txList_.filter((t) => t.vehicle_type === 'PICKUP').length,
      trukCount: txList_.filter((t) => t.vehicle_type === 'TRUK').length,
      cashTotal,
      expectedCash: (shiftData?.opening_cash ?? 0) + cashTotal,
    })
  }

  async function confirmCloseShift() {
    if (!activeShiftId || !user) return
    setClosing(true)
    setCloseError('')
    try {
      const actualCash = parseInt(closingCash.replace(/\D/g, ''), 10) || 0
      const diff = shiftSummary ? actualCash - shiftSummary.expectedCash : 0

      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'CLOSED',
          closing_cash: actualCash,
          expected_cash: shiftSummary?.expectedCash ?? 0,
          actual_cash: actualCash,
          difference: diff,
          note: closeNote,
          closed_at: new Date().toISOString(),
        })
        .eq('id', activeShiftId)

      if (error) throw error

      await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: activeShiftId, diff, note: closeNote }),
      })

      setShowCloseShift(false)
      router.push('/shifts?closed=1')
    } catch {
      setCloseError('Gagal menutup shift.')
    } finally {
      setClosing(false)
    }
  }

  // --- Sidebar item component ---
  const NavItem = ({ href, label, icon: Icon, isCollapsed }: { href: string, label: string, icon: any, isCollapsed?: boolean }) => {
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

      {/* Main Content Area */}
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
          {activeShiftId && (
            <Button
              size="sm"
              variant="outline"
              onClick={openCloseShiftModal}
              className="border-red-700 text-red-400 hover:bg-red-900/30 hover:text-red-300"
            >
              Tutup Shift
            </Button>
          )}
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
          <div className="flex-1" />
          {activeShiftId && (
            <Button
              size="sm"
              variant="outline"
              onClick={openCloseShiftModal}
              className="border-red-700 text-red-400 hover:bg-red-900/30 hover:text-red-300"
            >
              Tutup Shift
            </Button>
          )}
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
                <Icon className={cn("w-5 h-5", active ? "fill-primary/20" : "")} />
              </div>
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Modal Tutup Shift */}
      {showCloseShift && shiftSummary && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Tutup Shift</h2>
              <button
                onClick={() => setShowCloseShift(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Total Transaksi</p>
                  <p className="text-xl font-bold text-white">{shiftSummary.totalTx}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Total Omzet</p>
                  <p className="text-xl font-bold text-green-400">
                    Rp {(shiftSummary.totalOmzet / 1000).toFixed(1)}rb
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Motor</p>
                  <p className="font-bold">{shiftSummary.motorCount}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Mobil</p>
                  <p className="font-bold">{shiftSummary.mobilCount}</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Kas Awal + Cash Tx</span>
                  <span className="font-semibold">
                    Rp {(shiftSummary.expectedCash / 1000).toFixed(1)}rb
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Kas Actual di Laci</span>
                  <span className="font-semibold text-blue-400">
                    Rp {parseInt(closingCash.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}
                  </span>
                </div>
                {shiftSummary.expectedCash > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Selisih</span>
                    <span
                      className={`font-bold ${
                        (parseInt(closingCash.replace(/\D/g, '') || '0', 10) - shiftSummary.expectedCash) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      Rp{' '}
                      {Math.abs(
                        parseInt(closingCash.replace(/\D/g, '') || '0', 10) - shiftSummary.expectedCash
                      ).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium">
                  Kas Actual di Laci (Rupiah)
                </label>
                <input
                  type="text"
                  value={closingCash}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setClosingCash(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                  }}
                  placeholder="Contoh: 500000"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500"
                />
              </div>

              {closeError && (
                <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-md">
                  {closeError}
                </div>
              )}

              <Button
                onClick={confirmCloseShift}
                disabled={closing || !closingCash}
                className="w-full bg-red-600 hover:bg-red-500 text-white"
              >
                {closing ? 'Memproses...' : 'Tutup Shift'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
