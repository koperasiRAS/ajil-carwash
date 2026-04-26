'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const LOCKOUT_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

function getLoginAttempts(): { count: number; lockedUntil: number } {
  if (typeof window === 'undefined') return { count: 0, lockedUntil: 0 }
  const raw = localStorage.getItem('login_attempts') || '{"count":0,"lockedUntil":0}'
  return JSON.parse(raw)
}

function setLoginAttempts(data: { count: number; lockedUntil: number }) {
  localStorage.setItem('login_attempts', JSON.stringify(data))
}

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const setActiveShift = useAuthStore((s) => s.setActiveShift)
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(getLoginAttempts)

  const isLocked =
    attempts.lockedUntil > 0 && Date.now() < attempts.lockedUntil

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked) {
      const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000)
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${remaining} menit.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (authError || !authData.user) {
        handleFailedAttempt()
        setError('Email atau password salah.')
        return
      }

      // 2. Get user role from users table
      const userId = authData.user.id
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (dbError || !dbUser) {
        await supabase.auth.signOut()
        setError('Akun tidak ditemukan.')
        return
      }

      // 3. Check if active
      if (!dbUser.is_active) {
        await supabase.auth.signOut()
        setError('Akun dinonaktifkan. Hubungi owner.')
        return
      }

      // 4. Reset attempt counter on success
      setLoginAttempts({ count: 0, lockedUntil: 0 })

      // 5. Check if user has open shift (for KASIR)
      let activeShiftId: string | null = null
      if (dbUser.role === 'KASIR') {
        const { data: openShift } = await supabase
          .from('shifts')
          .select('id')
          .eq('kasir_id', userId)
          .eq('status', 'OPEN')
          .single()
        activeShiftId = openShift?.id ?? null
      }

      // 6. Set auth store
      setUser({
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        isActive: dbUser.is_active,
      })
      setActiveShift(activeShiftId)

      // 7. Audit log — USER_LOGIN
      await fetch('/api/auth/login-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUser.id,
          userName: dbUser.name,
          action: 'USER_LOGIN',
          entity: 'User',
          entityId: dbUser.id,
        }),
      }).catch(() => {}) // non-blocking

      // 8. Redirect
      if (dbUser.role === 'OWNER') {
        router.push('/dashboard')
      } else if (activeShiftId) {
        router.push('/kasir')
      } else {
        router.push('/shift')
      }
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
            Sistem Manajemen Car Wash
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@carwash.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLocked || loading}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLocked || loading}
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            {isLocked && (
              <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-400 text-sm px-3 py-2 rounded-md">
                Akun terkunci sementara. Coba lagi dalam{' '}
                {Math.ceil((attempts.lockedUntil - Date.now()) / 60000)} menit.
              </div>
            )}

            <Button
              type="submit"
              disabled={isLocked || loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
