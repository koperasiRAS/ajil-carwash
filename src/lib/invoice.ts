export function generateInvoiceNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.getTime().toString().slice(-4)
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `CW-${date}-${time}${random}`
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function parseRupiah(rupiah: string): number {
  return parseInt(rupiah.replace(/[^0-9]/g, ''), 10) || 0
}
