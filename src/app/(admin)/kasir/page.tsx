'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/invoice'
import { Receipt } from '@/components/kasir/Receipt'
import { Plus, X, Printer, ShoppingCart, Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

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

const DRAFT_KEY = 'carwash_kasir_draft'

// ── sessionStorage draft helpers ─────────────────────────────────────
function saveDraft(data: { platNomor: string; customerName: string; vehicleType: VehicleType; cart: CartEntry[]; discount: number }) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  } catch {}
}

function loadDraft(): { platNomor: string; customerName: string; vehicleType: VehicleType; cart: CartEntry[]; discount: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
}

export default function KasirPage() {
  const { user } = useAuthStore()

  const [step, setStep] = useState<Step>('input')
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOBIL')
  const [platNomor, setPlatNomor] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const [svcName, setSvcName] = useState('')
  const [svcPrice, setSvcPrice] = useState('')

  const [cart, setCart] = useState<CartEntry[]>([])
  const [receipt, setReceipt] = useState<TransactionResult | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const cartSubtotal = cart.reduce((s, c) => s + c.subtotal, 0)
  const cartTotal = Math.max(0, cartSubtotal - discount)

  // ── Load draft on mount ─────────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setPlatNomor(draft.platNomor)
      setCustomerName(draft.customerName)
      setVehicleType(draft.vehicleType)
      setCart(draft.cart)
      setDiscount(draft.discount)
    }
  }, [])

  // ── Auto-save draft on changes ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'input') return
    saveDraft({ platNomor, customerName, vehicleType, cart, discount })
  }, [platNomor, customerName, vehicleType, cart, discount, step])

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

  function addManualService() {
    const name = svcName.trim()
    const price = parseInt(svcPrice.replace(/\D/g, ''), 10) || 0
    if (!name) { setError('Nama layanan harus diisi.'); return }
    if (price <= 0) { setError('Harga harus lebih dari 0.'); return }

    const existing = cart.find((c) => c.serviceName === name)
    if (existing) {
      setCart(cart.map((c) =>
        c.serviceName === name ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.price } : c
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
      c.serviceName === serviceName ? { ...c, quantity: qty, subtotal: qty * c.price } : c
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
    clearDraft()
  }

  function handleProceed() {
    setError('')
    if (!platNomor.trim()) { setError('Plat nomor WAJIB diisi.'); return }
    if (cart.length === 0) { setError('Pilih minimal satu layanan.'); return }
    setStep('confirm')
  }

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
      clearDraft()
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

  // ── Input Step ──────────────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="space-y-4">
        <div className="page-header mb-0">
          <h1>Transaksi Baru</h1>
          <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Info Row */}
        <div className="card">
          <div className="px-5 pt-5 pb-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Info Kendaraan</p>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Plat Nomor *</label>
                <input type="text" value={platNomor} onChange={(e) => setPlatNomor(e.target.value.toUpperCase())}
                  placeholder="B 1234 XYZ" autoFocus
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2.5 uppercase placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nama Pelanggan</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="(opsional)"
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Tabs + Quick Services */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-border">
            {VEHICLE_TABS.map((tab) => (
              <button key={tab.value} onClick={() => setVehicleType(tab.value)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  vehicleType === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pilih Layanan</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_SERVICES[vehicleType].map((svc) => (
                <button key={svc.name} onClick={() => addQuickService(svc)}
                  className="bg-background hover:bg-accent border border-border hover:border-primary/40 rounded-xl p-3 text-left transition-all active:scale-[0.98]">
                  <p className="text-foreground text-sm font-medium leading-tight">{svc.name}</p>
                  <p className="text-emerald-600 text-sm font-bold mt-1">{formatRupiah(svc.price)}</p>
                </button>
              ))}
            </div>

            {/* Manual Add */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">+ Tambah Manual</p>
              <div className="flex gap-2">
                <input type="text" value={svcName} onChange={(e) => setSvcName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualService()}
                  placeholder="Nama layanan baru..."
                  className="flex-1 bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
                <input type="text" value={svcPrice} onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setSvcPrice(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && addManualService()}
                  placeholder="Rp 0"
                  className="w-32 bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-right" />
                <button onClick={addManualService}
                  className="btn-primary p-2 rounded-lg active:scale-[0.98] transition-transform">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Keranjang</span>
              {cart.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-medium">Hapus semua</button>
            )}
          </div>

          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                Belum ada layanan dipilih
              </div>
            ) : cart.map((entry) => (
              <div key={entry.serviceName} className="flex items-center gap-2 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{entry.serviceName}</p>
                  <p className="text-muted-foreground text-xs">{formatRupiah(entry.price)} × {entry.quantity}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQty(entry.serviceName, entry.quantity - 1)}
                    className="w-7 h-7 bg-background hover:bg-accent border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <span className="text-sm">−</span>
                  </button>
                  <span className="w-8 text-center text-foreground text-sm font-medium">{entry.quantity}</span>
                  <button onClick={() => updateQty(entry.serviceName, entry.quantity + 1)}
                    className="w-7 h-7 bg-background hover:bg-accent border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-emerald-600 text-sm font-semibold min-w-[80px] text-right">
                  {formatRupiah(entry.subtotal)}
                </span>
                <button onClick={() => removeFromCart(entry.serviceName)}
                  className="text-muted-foreground hover:text-red-500 p-1 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="px-5 py-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>{formatRupiah(cartSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Diskon</span>
                <div className="flex items-center gap-1">
                  <span className="text-red-500">−</span>
                  <input type="text" value={discount > 0 ? formatRupiah(discount) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      setDiscount(parseInt(raw, 10) || 0)
                    }}
                    placeholder="Rp 0"
                    className="bg-transparent text-right text-foreground w-28 text-sm border-b border-border focus:border-primary outline-none transition-colors" />
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
                <span>TOTAL</span>
                <span className="text-emerald-600">{formatRupiah(cartTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <Button onClick={handleProceed} disabled={!platNomor.trim() || cart.length === 0}
          className="w-full btn-primary shadow-sm text-base py-3.5 font-semibold rounded-xl">
          Lanjut ke Pembayaran →
        </Button>
      </div>
    )
  }

  // ── Confirm Step ────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="space-y-4">
        <div className="page-header mb-0">
          <h1>Konfirmasi Pembayaran</h1>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kendaraan</span>
            <div className="text-right">
              <p className="font-bold text-foreground text-sm">{platNomor}</p>
              <p className="text-muted-foreground text-xs">{vehicleType} {customerName && `· ${customerName}`}</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {cart.map((entry) => (
              <div key={entry.serviceName} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{entry.serviceName} ×{entry.quantity}</span>
                <span className="text-foreground">{formatRupiah(entry.subtotal)}</span>
              </div>
            ))}
          </div>
          {discount > 0 && (
            <div className="px-5 pb-4 flex justify-between text-sm text-red-500">
              <span>Diskon</span><span>−{formatRupiah(discount)}</span>
            </div>
          )}
          <div className="px-5 pb-5 flex justify-between text-xl font-bold border-t border-border pt-4">
            <span className="text-foreground">TOTAL</span>
            <span className="text-emerald-600">{formatRupiah(cartTotal)}</span>
          </div>
        </div>

        <div className="card">
          <div className="px-5 pt-5 pb-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Metode Bayar</p>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'TRANSFER', 'QRIS'] as PayMethod[]).map((m) => (
                <button key={m} onClick={() => { setPaymentMethod(m); setPaymentAmount('') }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    paymentMethod === m
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'bg-background border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}>
                  {PAY_LABELS[m]}
                </button>
              ))}
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <input type="text" value={paymentAmount} onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setPaymentAmount(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                  }}
                  placeholder="Jumlah uang diterima (Rp)" autoFocus
                  className="w-full bg-background border border-border text-foreground text-base rounded-xl px-4 py-3 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-center font-mono" />
                {cashPaid >= cartTotal && cashPaid > 0 && (
                  <p className="text-center text-sm text-emerald-600 font-semibold">
                    Kembalian: {formatRupiah(cashPaid - cartTotal)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => { setStep('input'); setError('') }} variant="outline" className="flex-1 py-3">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
          </Button>
          <Button onClick={handlePay} disabled={processing}
            className="flex-1 btn-primary shadow-sm py-3 font-semibold rounded-xl">
            {processing ? 'Memproses...' : '✓ Bayar Sekarang'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Done Step ────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <>
        <div className="space-y-4">
          <div className="card p-6 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Transaksi Berhasil!</h2>
            <p className="text-muted-foreground text-sm">Struk dapat dicetak di bawah ini.</p>
          </div>

          <Button onClick={() => setShowReceipt(true)}
            className="w-full btn-primary shadow-sm py-3">
            <Printer className="w-4 h-4 mr-2" /> Lihat & Cetak Struk
          </Button>

          <Button onClick={resetForm}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm py-3 font-semibold rounded-xl">
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

function ReceiptDialog({ receipt, open, onClose }: { receipt: TransactionResult; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-card border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Struk Transaksi</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
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