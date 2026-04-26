'use client'

interface FormatRupiahProps {
  amount: number
  className?: string
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function FormatRupiah({ amount, className }: FormatRupiahProps) {
  return <span className={className}>{formatRupiah(amount)}</span>
}

export default FormatRupiah