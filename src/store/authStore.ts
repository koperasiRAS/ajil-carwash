import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  activeShiftId: string | null
  setUser: (user: User | null) => void
  setActiveShift: (shiftId: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeShiftId: null,
      setUser: (user) => set({ user }),
      setActiveShift: (shiftId) => set({ activeShiftId: shiftId }),
      logout: () => set({ user: null, activeShiftId: null }),
    }),
    { name: 'auth-storage' }
  )
)
