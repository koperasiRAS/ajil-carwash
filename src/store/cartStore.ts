import { create } from 'zustand'
import type { CartItem, Service } from '@/types'

interface CartState {
  items: CartItem[]
  vehicleType: string
  vehiclePlate: string
  customerName: string
  discount: number
  addService: (service: Service) => void
  removeService: (serviceId: string) => void
  updateQuantity: (serviceId: string, qty: number) => void
  setVehicleType: (type: string) => void
  setVehiclePlate: (plate: string) => void
  setCustomerName: (name: string) => void
  setDiscount: (amount: number) => void
  clearCart: () => void
  subtotal: () => number
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  vehicleType: 'MOBIL',
  vehiclePlate: '',
  customerName: '',
  discount: 0,

  addService: (service) => {
    const { items } = get()
    const existing = items.find((i) => i.service.id === service.id)
    if (existing) {
      set({
        items: items.map((i) =>
          i.service.id === service.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.service.price }
            : i
        ),
      })
    } else {
      set({
        items: [...items, { service, quantity: 1, subtotal: service.price }],
      })
    }
  },

  removeService: (serviceId) =>
    set((state) => ({ items: state.items.filter((i) => i.service.id !== serviceId) })),

  updateQuantity: (serviceId, qty) => {
    const { items } = get()
    if (qty <= 0) {
      set({ items: items.filter((i) => i.service.id !== serviceId) })
      return
    }
    set({
      items: items.map((i) =>
        i.service.id === serviceId
          ? { ...i, quantity: qty, subtotal: qty * i.service.price }
          : i
      ),
    })
  },

  setVehicleType: (vehicleType) => set({ vehicleType, items: [] }),
  setVehiclePlate: (vehiclePlate) => set({ vehiclePlate }),
  setCustomerName: (customerName) => set({ customerName }),
  setDiscount: (discount) => set({ discount }),

  clearCart: () =>
    set({ items: [], vehiclePlate: '', customerName: '', discount: 0 }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

  total: () => get().items.reduce((sum, i) => sum + i.subtotal, 0) - get().discount,
}))
