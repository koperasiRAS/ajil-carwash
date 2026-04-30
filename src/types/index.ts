// Simplified types — no shift, stock, audit, service master data

export type TransactionStatus = 'COMPLETED' | 'VOIDED'
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS'
export type VehicleType = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'

export interface User {
  id: string
  name: string
  email?: string
  isActive: boolean
}

export interface TransactionItem {
  id: string
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}

export interface Transaction {
  id: string
  invoiceNumber: string
  kasirId: string
  platNomor: string
  customerName?: string
  vehicleType: VehicleType
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
  kasir?: User
}