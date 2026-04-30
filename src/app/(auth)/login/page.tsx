'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const LOCKOUT_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

function getLoginAttempts(): { count: number; lockedUntil: number } {
  if (typeof window === 'undefined') return { count: 0, lockedUntil: 0 }
  const raw = localStorage.getItem('cw_login_attempts') || '{"count":0,"lockedUntil":0}'
  return JSON.parse(raw)
}

function setLoginAttempts(data: { count: number; lockedUntil: number }) {
  localStorage.setItem('cw_login_attempts', JSON.stringify(data))
}

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(getLoginAttempts)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const isLocked = attempts.lockedUntil > 0 && now < attempts.lockedUntil

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked) {
      const remaining = Math.ceil((attempts.lockedUntil - now) / 60000)
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${remaining} menit.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        handleFailedAttempt()
        setError(data.error ?? 'PIN tidak valid')
        return
      }

      // Reset attempt counter
      setLoginAttempts({ count: 0, lockedUntil: 0 })

      // Set auth store
      setUser(data.user)

      // Redirect to dashboard
      router.push(data.redirectTo ?? '/dashboard')
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function handleFailedAttempt() {
    const current = getLoginAttempts()
    const newCount = current.count + 1
    const lockedUntil =
      newCount >= LOCKOUT_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0
    const data = { count: newCount, lockedUntil }
    setLoginAttempts(data)
    setAttempts(data)
    if (newCount >= LOCKOUT_ATTEMPTS) {
      setError(`Terlalu banyak percobaan. Kunci akun selama 15 menit.`)
    }
  }

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(val)
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-800">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-neutral-800 p-3 rounded-full">
              <Car className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">CarWash Manager</CardTitle>
          <CardDescription className="text-neutral-400">
            Masukkan PIN untuk masuk
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            {/* PIN Input - big numeric keypad friendly */}
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="● ● ● ●"
                value={pin}
                onChange={handlePinChange}
                disabled={isLocked || loading}
                autoFocus
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-center text-3xl tracking-[1em] px-4 py-4 rounded-lg placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="text-center text-xs text-neutral-500">
                Masukkan 4-6 digit PIN Anda
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-md text-center">
                {error}
              </div>
            )}

            {isLocked && (
              <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-400 text-sm px-3 py-2 rounded-md text-center">
                Akun terkunci sementara. Coba lagi dalam{' '}
                {Math.ceil((attempts.lockedUntil - now) / 60000)} menit.
              </div>
            )}

            <Button
              type="submit"
              disabled={isLocked || loading || pin.length < 4}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 text-base"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}