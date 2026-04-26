export type Role = 'OWNER' | 'KASIR'
export type ShiftStatus = 'OPEN' | 'CLOSED'
export type TransactionStatus = 'COMPLETED' | 'VOIDED'
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS'
export type VehicleType = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
export type StockLogType = 'IN' | 'OUT' | 'ADJUSTMENT'
export type ExpenseCategory =
  | 'OPERASIONAL'
  | 'GAJI'
  | 'SABUN_CHEMICAL'
  | 'LISTRIK_AIR'
  | 'PERALATAN'
  | 'LAINNYA'

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'TRANSACTION_CREATE'
  | 'TRANSACTION_VOID'
  | 'SERVICE_CREATE'
  | 'SERVICE_UPDATE'
  | 'SERVICE_DELETE'
  | 'PRICE_CHANGE'
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'EMPLOYEE_DELETE'
  | 'STOCK_CREATE'
  | 'STOCK_UPDATE'
  | 'STOCK_ADJUSTMENT'
  | 'EXPENSE_CREATE'
  | 'DISCOUNT_APPLY'
  | 'SETTING_CHANGE'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
}

export interface Service {
  id: string
  name: string
  description?: string
  price: number
  category: VehicleType
  durationMinutes: number
  isActive: boolean
}

export interface CartItem {
  service: Service
  quantity: number
  subtotal: number
}

export interface Shift {
  id: string
  kasirId: string
  kasir: User
  openingCash: number
  status: ShiftStatus
  openedAt: string
}

export interface Transaction {
  id: string
  invoiceNumber: string
  kasir: User
  customerName?: string
  vehicleType: VehicleType
  vehiclePlate?: string
  paymentMethod: PaymentMethod
  subtotal: number
  discount: number
  total: number
  paymentAmount: number
  change: number
  status: TransactionStatus
  voidReason?: string
  createdAt: string
  items: TransactionItem[]
}

export interface TransactionItem {
  id: string
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}
