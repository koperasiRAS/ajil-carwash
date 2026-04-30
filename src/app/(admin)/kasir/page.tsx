'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/invoice'
import { Receipt } from '@/components/kasir/Receipt'
import { Plus, X, Printer, ShoppingCart, Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog'

type VehicleType = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
type PayMethod = 'CASH' | 'TRANSFER' | 'QRIS'

const VEHICLE_TABS: { label: string; value: VehicleType }[] = [
  { label: 'Motor', value: 'MOTOR' },
  { label: 'Mobil', value: 'MOBIL' },
  { label: 'Pickup', value: 'PICKUP' },
  { label: 'Truk', value: 'TRUK' },
]

const PAY_LABELS: Record<PayMethod, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

// Predefined quick-add services per vehicle type
const QUICK_SERVICES: Record<VehicleType, { name: string; price: number }[]> = {
  MOTOR: [
    { name: 'Cuci Motor Reguler', price: 15000 },
    { name: 'Cuci Motor Salon', price: 25000 },
    { name: 'Cuci + Wax Motor', price: 35000 },
  ],
  MOBIL: [
    { name: 'Cuci Mobil Reguler', price: 30000 },
    { name: 'Cuci Mobil Salon', price: 50000 },
    { name: 'Cuci + Wax Mobil', price: 70000 },
    { name: 'Poles Mobil', price: 150000 },
    { name: 'Interior Cleaning', price: 100000 },
  ],
  PICKUP: [
    { name: 'Cuci Pickup', price: 45000 },
    { name: 'Cuci + Wax Pickup', price: 75000 },
  ],
  TRUK: [
    { name: 'Cuci Truk', price: 75000 },
    { name: 'Cuci Truk Salon', price: 120000 },
  ],
}

interface CartEntry {
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}

interface TransactionResult {
  id: string
  invoiceNumber: string
  createdAt: string
  kasirName: string
  customerName: string
  platNomor: string
  vehicleType: VehicleType
  items: { serviceName: string; price: number; quantity: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PayMethod
  paymentAmount: number
  change: number
}

type Step = 'input' | 'confirm' | 'done'

export default function KasirPage() {
  const { user } = useAuthStore()

  // ── State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input')
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOBIL')
  const [platNomor, setPlatNomor] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  // Manual service input
  const [svcName, setSvcName] = useState('')
  const [svcPrice, setSvcPrice] = useState('')

  const [cart, setCart] = useState<CartEntry[]>([])
  const [receipt, setReceipt] = useState<TransactionResult | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const cartSubtotal = cart.reduce((s, c) => s + c.subtotal, 0)
  const cartTotal = Math.max(0, cartSubtotal - discount)

  // ── Add to cart from quick select ──────────────────────────────────
  function addQuickService(service: { name: string; price: number }) {
    const existing = cart.find((c) => c.serviceName === service.name)
    if (existing) {
      setCart(cart.map((c) =>
        c.serviceName === service.name
          ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.price }
          : c
      ))
    } else {
      setCart([...cart, { serviceName: service.name, price: service.price, quantity: 1, subtotal: service.price }])
    }
  }

  // ── Add to cart from manual input ──────────────────────────────────
  function addManualService() {
    const name = svcName.trim()
    const price = parseInt(svcPrice.replace(/\D/g, ''), 10) || 0
    if (!name) { setError('Nama layanan harus diisi.'); return }
    if (price <= 0) { setError('Harga harus lebih dari 0.'); return }

    const existing = cart.find((c) => c.serviceName === name)
    if (existing) {
      setCart(cart.map((c) =>
        c.serviceName === name
          ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.price }
          : c
      ))
    } else {
      setCart([...cart, { serviceName: name, price, quantity: 1, subtotal: price }])
    }

    setSvcName('')
    setSvcPrice('')
    setError('')
  }

  function removeFromCart(serviceName: string) {
    setCart(cart.filter((c) => c.serviceName !== serviceName))
  }

  function updateQty(serviceName: string, qty: number) {
    if (qty <= 0) { removeFromCart(serviceName); return }
    setCart(cart.map((c) =>
      c.serviceName === serviceName
        ? { ...c, quantity: qty, subtotal: qty * c.price }
        : c
    ))
  }

  function resetForm() {
    setStep('input')
    setPlatNomor('')
    setCustomerName('')
    setDiscount(0)
    setPaymentMethod('CASH')
    setPaymentAmount('')
    setCart([])
    setSvcName('')
    setSvcPrice('')
    setError('')
  }

  // ── Validation before confirm ───────────────────────────────────────
  function handleProceed() {
    setError('')
    if (!platNomor.trim()) { setError('Plat nomor WAJIB diisi.'); return }
    if (cart.length === 0) { setError('Pilih minimal satu layanan.'); return }
    setStep('confirm')
  }

  // ── Process payment ────────────────────────────────────────────────
  async function handlePay() {
    if (paymentMethod === 'CASH') {
      const paid = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0
      if (paid < cartTotal) {
        setError(`Pembayaran kurang dari total (${formatRupiah(cartTotal)}).`)
        return
      }
    }

    setProcessing(true)
    setError('')

    try {
      const paidAmount = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platNomor: platNomor.trim().toUpperCase(),
          customerName: customerName.trim() || undefined,
          vehicleType,
          paymentMethod,
          items: cart.map((c) => ({
            serviceName: c.serviceName,
            price: c.price,
            quantity: c.quantity,
            subtotal: c.subtotal,
          })),
          subtotal: cartSubtotal,
          discount,
          total: cartTotal,
          paymentAmount: paidAmount,
          change: paymentMethod === 'CASH' ? paidAmount - cartTotal : 0,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan transaksi.')
        return
      }

      const tx: any = data

      setReceipt({
        id: tx.id,
        invoiceNumber: tx.invoiceNumber,
        createdAt: tx.createdAt,
        kasirName: user?.name ?? 'Admin',
        customerName,
        platNomor: platNomor.trim().toUpperCase(),
        vehicleType,
        items: cart.map((c) => ({
          serviceName: c.serviceName,
          price: c.price,
          quantity: c.quantity,
          subtotal: c.subtotal,
        })),
        subtotal: cartSubtotal,
        discount,
        total: cartTotal,
        paymentMethod,
        paymentAmount: paidAmount,
        change: paymentMethod === 'CASH' ? paidAmount - cartTotal : 0,
      })
      setStep('done')
      setShowReceipt(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
    } finally {
      setProcessing(false)
    }
  }

  const cashPaid = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0
  const changeAmount = paymentMethod === 'CASH' ? Math.max(0, cashPaid - cartTotal) : 0

  // ── Render: Input Step ───────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Transaksi Baru</h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Info Row: Plat + Nama */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Info Kendaraan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Plat Nomor *</label>
              <input
                type="text"
                value={platNomor}
                onChange={(e) => setPlatNomor(e.target.value.toUpperCase())}
                placeholder="B 1234 XYZ"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 uppercase placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nama Pelanggan</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="(opsional)"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Type Tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-800">
            {VEHICLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setVehicleType(tab.value)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  vehicleType === tab.value
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Add Services */}
          <div className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pilih Layanan</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_SERVICES[vehicleType].map((svc) => (
                <button
                  key={svc.name}
                  onClick={() => addQuickService(svc)}
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-xl p-3 text-left transition-all active:scale-95"
                >
                  <p className="text-white text-sm font-medium leading-tight">{svc.name}</p>
                  <p className="text-green-400 text-sm font-bold mt-1">{formatRupiah(svc.price)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Add */}
          <div className="p-4 pt-0 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">+ Tambah Manual</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualService()}
                placeholder="Nama layanan baru..."
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={svcPrice}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  setSvcPrice(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                }}
                onKeyDown={(e) => e.key === 'Enter' && addManualService()}
                placeholder="Rp 0"
                className="w-32 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 text-right"
              />
              <button
                onClick={addManualService}
                className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg active:scale-95 transition-transform"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cart Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-300">Keranjang</span>
              {cart.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">
                Hapus semua
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-800 max-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-600 text-sm">
                Belum ada layanan dipilih
              </div>
            ) : cart.map((entry) => (
              <div key={entry.serviceName} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{entry.serviceName}</p>
                  <p className="text-gray-500 text-xs">{formatRupiah(entry.price)} × {entry.quantity}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQty(entry.serviceName, entry.quantity - 1)}
                    className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 flex items-center justify-center">
                    <span className="text-sm">−</span>
                  </button>
                  <span className="w-8 text-center text-white text-sm font-medium">{entry.quantity}</span>
                  <button onClick={() => updateQty(entry.serviceName, entry.quantity + 1)}
                    className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-green-400 text-sm font-semibold min-w-[80px] text-right">
                  {formatRupiah(entry.subtotal)}
                </span>
                <button onClick={() => removeFromCart(entry.serviceName)}
                  className="text-gray-600 hover:text-red-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Totals */}
          {cart.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-800 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>{formatRupiah(cartSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Diskon</span>
                <div className="flex items-center gap-1">
                  <span className="text-orange-500">−</span>
                  <input
                    type="text"
                    value={discount > 0 ? formatRupiah(discount) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      setDiscount(parseInt(raw, 10) || 0)
                    }}
                    placeholder="Rp 0"
                    className="bg-transparent text-right text-white w-28 text-sm border-b border-gray-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-gray-800">
                <span>TOTAL</span>
                <span className="text-green-400">{formatRupiah(cartTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <Button
          onClick={handleProceed}
          disabled={!platNomor.trim() || cart.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 text-base font-bold rounded-xl"
        >
          Lanjut ke Pembayaran →
        </Button>
      </div>
    )
  }

  // ── Render: Confirm Step ───────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Konfirmasi Pembayaran</h1>
        </div>

        {/* Summary Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Kendaraan</span>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{platNomor}</p>
              <p className="text-gray-500 text-xs">{vehicleType} {customerName && `· ${customerName}`}</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-3 space-y-2">
            {cart.map((entry) => (
              <div key={entry.serviceName} className="flex justify-between text-sm">
                <span className="text-gray-400">{entry.serviceName} ×{entry.quantity}</span>
                <span className="text-white">{formatRupiah(entry.subtotal)}</span>
              </div>
            ))}
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-orange-400">
              <span>Diskon</span><span>−{formatRupiah(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold border-t border-gray-800 pt-3">
            <span className="text-white">TOTAL</span>
            <span className="text-green-400">{formatRupiah(cartTotal)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Metode Bayar</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['CASH', 'TRANSFER', 'QRIS'] as PayMethod[]).map((m) => (
              <button key={m} onClick={() => { setPaymentMethod(m); setPaymentAmount('') }}
                className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                  paymentMethod === m
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {PAY_LABELS[m]}
              </button>
            ))}
          </div>

          {paymentMethod === 'CASH' && (
            <div className="space-y-2">
              <input
                type="text"
                value={paymentAmount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  setPaymentAmount(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                }}
                placeholder="Jumlah uang diterima (Rp)"
                className="w-full bg-gray-800 border border-gray-700 text-white text-base rounded-lg px-4 py-3 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 text-center font-mono"
                autoFocus
              />
              {cashPaid >= cartTotal && cashPaid > 0 && (
                <p className="text-center text-sm text-green-400 font-semibold">
                  Kembalian: {formatRupiah(cashPaid - cartTotal)}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => { setStep('input'); setError('') }}
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300 py-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
          </Button>
          <Button
            onClick={handlePay}
            disabled={processing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 text-base font-bold rounded-xl"
          >
            {processing ? 'Memproses...' : '✓ Bayar Sekarang'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: Done Step ───────────────────────────────────────────────
  if (step === 'done') {
    return (
      <>
        <div className="space-y-4">
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Transaksi Berhasil!</h2>
            <p className="text-gray-400 text-sm">Struk dapat dicetak di bawah ini.</p>
          </div>

          <Button
            onClick={() => setShowReceipt(true)}
            className="w-full border border-gray-700 text-gray-300 py-4"
          >
            <Printer className="w-4 h-4 mr-2" /> Lihat & Cetak Struk
          </Button>

          <Button
            onClick={resetForm}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 font-bold rounded-xl"
          >
            + Transaksi Baru
          </Button>
        </div>
        {receipt && (
          <ReceiptDialog receipt={receipt} open={showReceipt} onClose={() => setShowReceipt(false)} />
        )}
      </>
    )
  }

  return null
}

// ── Receipt Modal ────────────────────────────────────────────────────────
function ReceiptDialog({
  receipt,
  open,
  onClose,
}: {
  receipt: TransactionResult
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-gray-900 border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-bold">Struk Transaksi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <Receipt
            data={{
              invoiceNumber: receipt.invoiceNumber,
              createdAt: receipt.createdAt,
              kasirName: receipt.kasirName,
              customerName: receipt.customerName,
              platNomor: receipt.platNomor,
              vehicleType: receipt.vehicleType,
              items: receipt.items,
              subtotal: receipt.subtotal,
              discount: receipt.discount,
              total: receipt.total,
              paymentAmount: receipt.paymentAmount,
              change: receipt.change,
              paymentMethod: receipt.paymentMethod,
            }}
            onPrinted={() => {}}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}