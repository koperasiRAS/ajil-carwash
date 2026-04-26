'use client'

import { cn } from '@/lib/utils'

type StatusType = 'transaction' | 'shift' | 'stock' | 'service' | 'default'

type StatusValue =
  | 'COMPLETED' | 'VOIDED' | 'OPEN' | 'CLOSED'
  | 'ACTIVE' | 'INACTIVE' | 'MENIPIS' | 'KRITIS'
  | 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
  | string

interface StatusBadgeProps {
  status: StatusValue
  type?: StatusType
  className?: string
}

const CONFIG: Record<string, { label: string; className: string }> = {
  // Transaction
  COMPLETED: { label: 'Selesai', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800' },
  VOIDED:   { label: 'Void',    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' },
  // Shift
  OPEN:     { label: 'Buka',    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800' },
  CLOSED:   { label: 'Tutup',   className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  // Stock
  MENIPIS:  { label: 'Menipis', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800' },
  KRITIS:   { label: 'Kritis', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' },
  // Generic active/inactive
  ACTIVE:   { label: 'Aktif',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800' },
  INACTIVE: { label: 'Nonaktif',className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700' },
  // Vehicle
  MOTOR:    { label: 'Motor',   className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-800' },
  MOBIL:    { label: 'Mobil',   className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800' },
  PICKUP:   { label: 'Pickup',  className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-800' },
  TRUK:     { label: 'Truk',   className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' },
}

export function StatusBadge({ status, type = 'default', className }: StatusBadgeProps) {
  const config = CONFIG[status]
  if (!config) {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
        className
      )}>
        {status}
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      config.className,
      className
    )}>
      {config.label}
    </span>
  )
}

export default StatusBadge