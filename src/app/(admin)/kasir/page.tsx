'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah, generateInvoiceNumber } from '@/lib/invoice'
import { Receipt } from '@/components/kasir/Receipt'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Plus, Search, X, Minus, Printer, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { VehicleType } from '@/types'

interface ServiceItem {
  id: string
  name: string
  description: string | null
  price: number
  category: VehicleType
  duration_minutes: number
  is_active: boolean
}

interface CartEntry {
  service: ServiceItem
  quantity: number
  subtotal: number
}

type PayMethod = 'CASH' | 'TRANSFER' | 'QRIS'

interface TransactionResult {
  id: string
  invoiceNumber: string
  createdAt: string
  kasirName: string
  customerName: string
  vehiclePlate: string
  vehicleType: VehicleType
  items: { serviceName: string; price: number; quantity: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PayMethod
  paymentAmount: number
  change: number
}

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

export default function KasirPage() {
  const supabase = createClient()
  const { user, activeShiftId } = useAuthStore()

  const [services, setServices] = useState<ServiceItem[]>([])
  const [activeTab, setActiveTab] = useState<VehicleType>('MOBIL')
  const [search, setSearch] = useState('')
  const [loadingServices, setLoadingServices] = useState(true)

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'services' | 'cart'>('services')

  const [customerName, setCustomerName] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const [cart, setCart] = useState<CartEntry[]>([])
  const [receipt, setReceipt] = useState<TransactionResult | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const cartSubtotal = cart.reduce((s, c) => s + c.subtotal, 0)
  const cartTotal = cartSubtotal - discount

  useEffect(() => {
    ;(async () => {
      setLoadingServices(true)
      try {
        const { data } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true })
        setServices((data as ServiceItem[]) ?? [])
      } finally {
        setLoadingServices(false)
      }
    })()
  }, [])

  function addToCart(service: ServiceItem) {
    const existing = cart.find((c) => c.service.id === service.id)
    if (existing) {
      setCart(cart.map((c) =>
        c.service.id === service.id
          ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.service.price }
          : c
      ))
    } else {
      setCart([...cart, { service, quantity: 1, subtotal: service.price }])
    }
  }

  function removeFromCart(serviceId: string) {
    setCart(cart.filter((c) => c.service.id !== serviceId))
  }

  function updateQty(serviceId: string, qty: number) {
    if (qty <= 0) { removeFromCart(serviceId); return }
    setCart(cart.map((c) =>
      c.service.id === serviceId
        ? { ...c, quantity: qty, subtotal: qty * c.service.price }
        : c
    ))
  }

  async function handleProcess() {
    if (cart.length === 0) { setError('Pilih minimal satu layanan.'); return }
    if (!activeShiftId) { setError('Shift belum dibuka.'); return }
    if (paymentMethod === 'CASH') {
      const paid = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0
      if (paid < cartTotal) {
        setError(`Pembayaran CASH kurang dari total (${formatRupiah(cartTotal)}).`)
        return
      }
    }

    setProcessing(true)
    setError('')

    try {
      const invoiceNumber = generateInvoiceNumber()
      const paidAmount = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0

      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          invoice_number: invoiceNumber,
          shift_id: activeShiftId,
          kasir_id: user!.id,
          customer_name: customerName || null,
          vehicle_type: activeTab,
          vehicle_plate: vehiclePlate || null,
          payment_method: paymentMethod,
          subtotal: cartSubtotal,
          discount,
          total: cartTotal,
          payment_amount: paidAmount,
          change: paymentMethod === 'CASH' ? paidAmount - cartTotal : 0,
          status: 'COMPLETED',
        })
        .select()
        .single()

      if (txErr || !tx) throw new Error(txErr?.message ?? 'Gagal menyimpan transaksi')

      await supabase.from('transaction_items').insert(
        cart.map((c) => ({
          transaction_id: tx.id,
          service_id: c.service.id,
          service_name: c.service.name,
          price: c.service.price,
          quantity: c.quantity,
          subtotal: c.subtotal,
        }))
      )

      await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.id,
          userName: user!.name,
          entityId: tx.id,
          newData: { invoiceNumber, total: cartTotal, vehicleType: activeTab },
        }),
      }).catch(() => {})

      setReceipt({
        id: tx.id, invoiceNumber,
        createdAt: tx.created_at,
        kasirName: user!.name,
        customerName, vehiclePlate,
        vehicleType: activeTab,
        items: cart.map((c) => ({ serviceName: c.service.name, price: c.service.price, quantity: c.quantity, subtotal: c.subtotal })),
        subtotal: cartSubtotal, discount, total: cartTotal,
        paymentMethod, paymentAmount: paidAmount,
        change: paymentMethod === 'CASH' ? paidAmount - cartTotal : 0,
      })
      setShowReceipt(true)
      setCart([])
      setCustomerName('')
      setVehiclePlate('')
      setDiscount(0)
      setPaymentAmount('')
      setPaymentMethod('CASH')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses transaksi.')
    } finally {
      setProcessing(false)
    }
  }

  const filteredServices = services.filter((s) =>
    s.category === activeTab &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()))
  )

  const cashDue = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0
  const changeAmount = paymentMethod === 'CASH' ? Math.max(0, cashDue - cartTotal) : 0

  // ── Render Helpers ──────────────────────────────────────────────────
  function renderServicesPanel() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 lg:p-4 border-b border-border space-y-3">
          <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Pilih Layanan
          </h2>

          {/* Vehicle tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
            {VEHICLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 py-1.5 lg:py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan..."
              className="w-full bg-input border border-border text-foreground pl-9 pr-4 py-2 rounded-lg text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {loadingServices ? (
            <LoadingSpinner label="Memuat layanan..." />
          ) : filteredServices.length === 0 ? (
            <EmptyState
              title="Tidak ada layanan"
              description="Tidak ada layanan ditemukan untuk kategori ini."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              {filteredServices.map((service) => (
                <div key={service.id}
                  className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between hover:border-primary/50 hover:shadow-sm transition-all">
                  <div>
                    <h3 className="font-semibold text-foreground text-xs lg:text-sm leading-tight">
                      {service.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {service.duration_minutes} menit
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs lg:text-sm">
                      {formatRupiah(service.price)}
                    </span>
                    <button
                      onClick={() => addToCart(service)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground p-1.5 rounded-lg">
                      <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderCartPanel() {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="p-3 lg:p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Keranjang
            </h2>
            {cart.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {cart.reduce((s, c) => s + c.quantity, 0)} item
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pelanggan"
              className="bg-input border border-border text-foreground text-sm rounded-lg px-3 py-2 placeholder:text-muted-foreground"
            />
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="Plat Nomor"
              className="bg-input border border-border text-foreground text-sm rounded-lg px-3 py-2 placeholder:text-muted-foreground uppercase"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2">
          {cart.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-8 h-8" />}
              title="Keranjang kosong"
              description="Pilih layanan untuk menambahkan ke keranjang."
            />
          ) : cart.map((entry) => (
            <div key={entry.service.id}
              className="bg-muted border border-border rounded-lg p-3 flex items-center gap-2 lg:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-medium truncate">{entry.service.name}</p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xs">{formatRupiah(entry.service.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(entry.service.id, entry.quantity - 1)}
                  className="bg-secondary hover:bg-accent p-1 rounded text-muted-foreground">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-foreground text-sm font-medium">{entry.quantity}</span>
                <button onClick={() => updateQty(entry.service.id, entry.quantity + 1)}
                  className="bg-secondary hover:bg-accent p-1 rounded text-muted-foreground">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-foreground text-sm font-semibold min-w-[60px] lg:min-w-[70px] text-right">
                {formatRupiah(entry.subtotal)}
              </span>
              <button onClick={() => removeFromCart(entry.service.id)}
                className="text-muted-foreground hover:text-destructive p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 lg:p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatRupiah(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Diskon</span>
              <div className="flex items-center gap-1">
                <span className="text-orange-500 dark:text-orange-400">-</span>
                <input
                  type="text"
                  value={discount > 0 ? formatRupiah(discount) : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '')
                    setDiscount(parseInt(raw, 10) || 0)
                  }}
                  placeholder="Rp 0"
                  className="bg-transparent text-right text-foreground w-24 text-sm border-b border-border focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t border-border">
              <span>TOTAL</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(cartTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(['CASH', 'TRANSFER', 'QRIS'] as PayMethod[]).map((method) => (
              <button key={method} onClick={() => setPaymentMethod(method)}
                className={`py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                  paymentMethod === method
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}>
                {PAY_LABELS[method]}
              </button>
            ))}
          </div>

          {paymentMethod === 'CASH' && (
            <div className="space-y-1">
              <input
                type="text"
                value={paymentAmount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  setPaymentAmount(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '')
                }}
                placeholder="Jumlah Bayar (Rp)"
                className="w-full bg-input border border-border text-foreground rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
              {cashDue > 0 && cashDue >= cartTotal && (
                <p className="text-center text-sm text-primary font-medium">
                  Kembalian: {formatRupiah(cashDue - cartTotal)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            onClick={handleProcess}
            disabled={processing || cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-sm lg:text-base font-bold"
          >
            {processing ? 'Memproses...' : 'PROSES TRANSAKSI'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop: side-by-side layout ── */}
      <div className="hidden lg:flex h-[calc(100vh-64px)]">
        <div className="w-3/5 border-r border-border">{renderServicesPanel()}</div>
        <div className="w-2/5">{renderCartPanel()}</div>
      </div>

      {/* ── Tablet: Stack layout ── */}
      <div className="hidden md:flex lg:hidden flex-col h-[calc(100vh-64px)]">
        <div className="h-1/2 border-b border-border overflow-hidden">{renderServicesPanel()}</div>
        <div className="h-1/2 overflow-hidden">{renderCartPanel()}</div>
      </div>

      {/* ── Mobile: tab switcher ── */}
      <div className="md:hidden flex flex-col h-[calc(100vh-56px)]">
        {/* Tab bar */}
        <div className="flex border-b border-border bg-card shrink-0">
          <button
            onClick={() => setMobileTab('services')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              mobileTab === 'services' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Layanan
            {mobileTab === 'services' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2 ${
              mobileTab === 'cart' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Cart
            {cart.length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
            {mobileTab === 'cart' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'services' ? (
            <div className="h-full">{renderServicesPanel()}</div>
          ) : (
            <div className="h-full">{renderCartPanel()}</div>
          )}
        </div>
      </div>

      {/* ── Receipt Modal ── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-white text-black">
          {receipt && (
            <Receipt
              data={{
                invoiceNumber: receipt.invoiceNumber,
                createdAt: receipt.createdAt,
                kasirName: receipt.kasirName,
                customerName: receipt.customerName,
                vehiclePlate: receipt.vehiclePlate,
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
          )}
          <DialogFooter className="p-4 border-t border-gray-200">
            <Button
              onClick={() => { setShowReceipt(false); setReceipt(null) }}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Transaksi Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}