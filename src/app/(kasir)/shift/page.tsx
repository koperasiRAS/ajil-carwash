'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Clock, Calendar, AlertCircle, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ShiftPage() {
  const router = useRouter()
  const { user, activeShiftId, setActiveShift } = useAuthStore()
  const supabase = createClient()

  const [openingCash, setOpeningCash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [alreadyClosed, setAlreadyClosed] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAlreadyClosed(new URLSearchParams(window.location.search).get('closed') === '1')
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Jika sudah punya shift aktif → langsung ke kasir
  useEffect(() => {
    if (activeShiftId) {
      router.replace('/kasir')
    }
  }, [activeShiftId])

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const cashValue = parseInt(openingCash.replace(/\D/g, ''), 10)
    if (!cashValue || cashValue < 0) {
      setError('Kas awal harus diisi dengan nominal yang valid.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Cek apakah sudah ada shift open hari ini
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()

      const { data: existingShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('kasir_id', user.id)
        .eq('status', 'OPEN')
        .gte('opened_at', todayStr)
        .single()

      if (existingShift) {
        setError('Kamu sudah punya shift yang aktif. Tidak bisa buka shift kedua.')
        setLoading(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from('shifts')
        .insert({
          kasir_id: user.id,
          opening_cash: cashValue,
          status: 'OPEN',
        })
        .select()
        .single()

      if (insertError || !data) {
        setError('Gagal membuka shift. Silakan coba lagi.')
        setLoading(false)
        return
      }

      setActiveShift(data.id)

      await fetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          action: 'SHIFT_OPEN',
          entity: 'Shift',
          entityId: data.id,
        }),
      }).catch(() => {})

      router.push('/kasir')
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <Car className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'CarWash Manager'}
          </h1>
        </div>

        {/* Shift already closed message */}
        {alreadyClosed ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center space-y-4">
            <div className="text-green-400 text-5xl">✓</div>
            <div>
              <h2 className="text-xl font-bold text-white">Shift Ditutup</h2>
              <p className="text-gray-400 mt-1">
                Shift kamu sudah ditutup. Silakan buka shift baru untuk melanjutkan.
              </p>
            </div>
            <Button
              onClick={() => router.replace('/shift')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              Buka Shift Baru
            </Button>
          </div>
        ) : (
          /* Buka Shift Form */
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Buka Shift Hari Ini
              </h2>
            </div>

            <form onSubmit={handleOpenShift} className="p-5 space-y-5">
              {/* Tanggal & Jam */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{formatDate(now)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{now.toLocaleTimeString('id-ID')}</span>
                </div>
              </div>

              {/* Info kasir */}
              <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() ?? 'K'}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{user?.name}</p>
                  <p className="text-gray-400 text-xs">{user?.email}</p>
                </div>
              </div>

              {/* Kas Awal */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Kas Awal di Laci
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={openingCash}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setOpeningCash(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="0"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-3 text-lg font-semibold placeholder:text-gray-500 placeholder:text-2xl placeholder:font-normal"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Masukkan jumlah uang tunai yang ada di laci kasir saat shift dimulai.
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-3 text-base font-bold"
              >
                {loading ? 'Memproses...' : 'Mulai Shift'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}