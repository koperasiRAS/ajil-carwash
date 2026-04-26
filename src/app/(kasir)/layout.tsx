'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Car, LogOut, Bell, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface ShiftInfo {
  id: string
  openedAt: string
}

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, activeShiftId, logout } = useAuthStore()
  const supabase = createClient()

  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [closingCash, setClosingCash] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [closing, setClosing] = useState(false)
  const [shiftSummary, setShiftSummary] = useState<{
    totalTx: number
    totalOmzet: number
    motorCount: number
    mobilCount: number
    pickupCount: number
    trukCount: number
    cashTotal: number
    expectedCash: number
  } | null>(null)
  const [closeError, setCloseError] = useState('')

  // Idle timeout — 30 menit
  const TIMEOUT_MS = 30 * 60 * 1000

  useEffect(() => {
    let lastActive = Date.now()
    const events = ['mousedown', 'keydown', 'touchstart']
    const reset = () => { lastActive = Date.now() }
    events.forEach((e) => window.addEventListener(e, reset))

    const interval = setInterval(() => {
      if (Date.now() - lastActive > TIMEOUT_MS) {
        handleLogout()
      }
    }, 60_000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!user || !activeShiftId) return
    supabase
      .from('shifts')
      .select('id, opened_at')
      .eq('id', activeShiftId)
      .single()
      .then(({ data }) => {
        if (data) setShiftInfo({ id: data.id, openedAt: data.opened_at })
      })
  }, [user, activeShiftId])

  async function handleLogout() {
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
  }

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
      router.push('/shift?closed=1')
    } catch {
      setCloseError('Gagal menutup shift.')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        {/* Kiri: Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg hidden sm:block">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'CarWash Manager'}
          </span>
        </div>

        {/* Tengah: Info kasir */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'K'}
            </div>
            <div>
              <p className="text-sm font-semibold">{user?.name}</p>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-400">Shift Aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kanan: Actions */}
        <div className="flex items-center gap-2">
          {pathname === '/kasir' && activeShiftId && (
            <Button
              size="sm"
              variant="outline"
              onClick={openCloseShiftModal}
              className="border-red-700 text-red-400 hover:bg-red-900/30 hover:text-red-300 hidden sm:flex"
            >
              Tutup Shift
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-gray-400 hover:text-white"
            title="Notifikasi"
          >
            <Bell className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            className="text-gray-400 hover:text-white"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>

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
              {/* Ringkasan */}
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