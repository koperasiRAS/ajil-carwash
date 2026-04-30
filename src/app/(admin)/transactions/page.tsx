'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/invoice'
import {
  Search, Download, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Eye, X,
  Filter, AlertTriangle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VehicleType } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────
interface TxItem {
  id: string
  service_name: string
  price: number
  quantity: number
  subtotal: number
}

interface Transaction {
  id: string
  invoice_number: string
  kasir_id: string
  kasir_name: string
  customer_name: string | null
  vehicle_type: VehicleType
  vehicle_plate: string | null
  payment_method: 'CASH' | 'TRANSFER' | 'QRIS'
  subtotal: number
  discount: number
  total: number
  payment_amount: number
  change: number
  status: 'COMPLETED' | 'VOIDED'
  void_reason: string | null
  void_by_name: string | null
  void_at: string | null
  created_at: string
  items: TxItem[]
}

interface Kasir { id: string; name: string }

type VoidReasonType = 'SALAH_INPUT' | 'PERMINTAAN_PELANGGAN' | 'DUPLIKAT' | 'LAINNYA'

const VOID_REASONS: { value: VoidReasonType; label: string }[] = [
  { value: 'SALAH_INPUT', label: 'Salah input data' },
  { value: 'PERMINTAAN_PELANGGAN', label: 'Permintaan pelanggan' },
  { value: 'DUPLIKAT', label: 'Transaksi duplikat' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

const PER_PAGE = 20

export default function TransactionsPage() {
  const supabase = createClient()
  const { user } = useAuthStore()

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [kasirId, setKasirId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [status, setStatus] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [search, setSearch] = useState('')

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [kasirs, setKasirs] = useState<Kasir[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingKasirs, setLoadingKasirs] = useState(true)

  // Detail modal
  const [detail, setDetail] = useState<Transaction | null>(null)

  // Void flow
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null)
  const [voidConfirm1, setVoidConfirm1] = useState(false)
  const [voidConfirm2, setVoidConfirm2] = useState(false)
  const [voidReasonType, setVoidReasonType] = useState<VoidReasonType>('SALAH_INPUT')
  const [voidReasonText, setVoidReasonText] = useState('')
  const [voidLoading, setVoidLoading] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [showToast, setShowToast] = useState(false)

  function showNotification(msg: string) {
    setToastMsg(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // Load kasirs
  useEffect(() => {
    supabase
      .from('users')
      .select('id, name')
      .eq('is_active', true)
      .then(({ data }) => setKasirs((data ?? []) as Kasir[]))
  }, [])

  // Load transactions
  const loadTx = useCallback(async () => {
    setLoading(true)
    const from = new Date(dateFrom)
    from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo)
    to.setHours(23, 59, 59, 999)

    let query = supabase
      .from('transactions')
      .select(
        `id, invoice_number, kasir_id, customer_name, vehicle_type, vehicle_plate,
         payment_method, subtotal, discount, total, payment_amount, change,
         status, void_reason, void_at, created_at,
         users!kasir_id(name),
         transaction_items(service_name, price, quantity, subtotal)`
      , { count: 'exact' })
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    if (kasirId) query = query.eq('kasir_id', kasirId)
    if (paymentMethod) query = query.eq('payment_method', paymentMethod)
    if (status) query = query.eq('status', status)
    if (vehicleType) query = query.eq('vehicle_type', vehicleType)
    if (search) {
      query = query.or(
        `invoice_number.ilike.%${search}%,vehicle_plate.ilike.%${search}%`
      )
    }

    const { data, count, error } = await query
    if (!error && data) {
      setTransactions(
        data.map((t) => ({
          id: t.id,
          invoice_number: t.invoice_number,
          kasir_id: t.kasir_id,
          kasir_name: (t.users as unknown as { name: string })?.name ?? '-',
          customer_name: t.customer_name,
          vehicle_type: t.vehicle_type,
          vehicle_plate: t.vehicle_plate,
          payment_method: t.payment_method,
          subtotal: t.subtotal,
          discount: t.discount,
          total: t.total,
          payment_amount: t.payment_amount,
          change: t.change,
          status: t.status,
          void_reason: t.void_reason,
          void_at: t.void_at,
          void_by_name: null,
          created_at: t.created_at,
          items: (t.transaction_items ?? []) as TxItem[],
        }))
      )
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [dateFrom, dateTo, kasirId, paymentMethod, status, vehicleType, search, page])

  useEffect(() => { loadTx() }, [loadTx])

  // Load void_by_name for detail
  useEffect(() => {
    if (!detail || detail.status !== 'VOIDED' || detail.void_by_name) return
    ;(async () => {
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', detail.kasir_id)
        .single()
      if (data) {
        setDetail((prev) => prev ? { ...prev, void_by_name: data.name } : null)
      }
    })()
  }, [detail])

  // Load kasir name for voided txs
  useEffect(() => {
    const voidedIds = transactions.filter((t) => t.status === 'VOIDED' && !t.void_by_name).map((t) => t.kasir_id)
    if (voidedIds.length === 0) return
    ;(async () => {
      const { data } = await supabase.from('users').select('id, name').in('id', voidedIds)
      if (!data) return
      setTransactions((prev) =>
        prev.map((t) => {
          const found = data.find((u) => u.id === t.kasir_id)
          return found ? { ...t, void_by_name: found.name } : t
        })
      )
    })()
  }, [transactions.map((t) => t.id).join(',')])

  async function handleVoid() {
    if (!voidTarget || !user) return
    if (voidReasonText.length < 20) {
      setVoidError('Alasan void minimal 20 karakter.')
      return
    }
    setVoidLoading(true)
    setVoidError('')
    try {
      const res = await fetch(`/api/transactions/${voidTarget.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonType: voidReasonType, reason: voidReasonText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal void transaksi')

      showNotification(`Transaksi ${voidTarget.invoice_number} berhasil dibatalkan.`)
      setVoidConfirm2(false)
      setVoidTarget(null)
      setVoidConfirm1(false)
      setVoidReasonText('')
      setVoidReasonType('SALAH_INPUT')
      await loadTx()
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Gagal void transaksi.')
    } finally {
      setVoidLoading(false)
    }
  }

  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const allData: Record<string, unknown>[] = []
    let currentPage = 1
    let hasMore = true

    while (hasMore) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      let query = supabase
        .from('transactions')
        .select(`*, users!kasir_id(name), transaction_items(service_name, price, quantity, subtotal)`)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * 500, currentPage * 500 - 1)

      if (kasirId) query = query.eq('kasir_id', kasirId)
      if (paymentMethod) query = query.eq('payment_method', paymentMethod)
      if (status) query = query.eq('status', status)
      if (vehicleType) query = query.eq('vehicle_type', vehicleType)
      if (search) query = query.or(`invoice_number.ilike.%${search}%,vehicle_plate.ilike.%${search}%`)

      const { data } = await query
      if (!data || data.length === 0) { hasMore = false; break }
      allData.push(...data.map((t: Record<string, unknown>) => ({
        ...t, kasir_name: (t.users as Record<string, unknown>)?.name ?? '-',
      })))
      if (data.length < 500) { hasMore = false }
      currentPage++
    }

    const sheet = allData.map((t: Record<string, unknown>, i: number) => ({
      No: i + 1,
      Invoice: t.invoice_number,
      Tanggal: new Date(t.created_at as string).toLocaleString('id-ID'),
      Kasir: t.kasir_name,
      Pelanggan: t.customer_name ?? '-',
      Kendaraan: `${t.vehicle_plate ?? '-'} (${t.vehicle_type})`,
      'Metode Bayar': t.payment_method,
      Subtotal: t.subtotal,
      Diskon: t.discount,
      Total: t.total,
      Bayar: t.payment_amount,
      Kembalian: t.change,
      Status: t.status,
      'Alasan Void': t.void_reason ?? '-',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheet)
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
    XLSX.writeFile(wb, `transaksi-${dateFrom}-${dateTo}.xlsx`)
  }

  async function handleExportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Laporan Transaksi CarWash', 10, 15)
    doc.setFontSize(9)
    doc.text(`Periode: ${dateFrom} s/d ${dateTo}`, 10, 22)
    doc.text(`Total: ${totalCount} transaksi`, 10, 29)

    const rows = transactions.map((t, i) => [
      (i + 1 + (page - 1) * PER_PAGE).toString(),
      t.invoice_number,
      new Date(t.created_at).toLocaleString('id-ID'),
      t.kasir_name,
      t.vehicle_type,
      formatRupiah(t.total),
      t.payment_method,
      t.status,
    ])
    // @ts-expect-error jsPDF autoTable types
    doc.autoTable({
      head: [['No', 'Invoice', 'Tanggal', 'Kasir', 'Kendaraan', 'Total', 'Metode', 'Status']],
      body: rows,
      startY: 35,
      styles: { fontSize: 8 },
    })
    doc.save(`transaksi-${dateFrom}-${dateTo}.pdf`)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 right-4 z-[100] bg-green-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Transaksi</h1>
          <p className="text-xs text-gray-500">{totalCount.toLocaleString('id-ID')} transaksi ditemukan</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Kasir</label>
            <select value={kasirId} onChange={(e) => { setKasirId(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5">
              <option value="">Semua Kasir</option>
              {kasirs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Metode Bayar</label>
            <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5">
              <option value="">Semua</option>
              <option value="CASH">CASH</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5">
              <option value="">Semua</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="VOIDED">VOIDED</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Kendaraan</label>
            <select value={vehicleType} onChange={(e) => { setVehicleType(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5">
              <option value="">Semua</option>
              <option value="MOTOR">MOTOR</option>
              <option value="MOBIL">MOBIL</option>
              <option value="PICKUP">PICKUP</option>
              <option value="TRUK">TRUK</option>
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari invoice atau plat nomor..."
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-4 py-2 placeholder:text-gray-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Kasir</th>
                <th className="text-left px-4 py-2.5 font-medium">Tanggal & Jam</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Kendaraan</th>
                <th className="text-right px-4 py-2.5 font-medium">Total</th>
                <th className="text-center px-4 py-2.5 font-medium hidden sm:table-cell">Metode</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                <th className="text-center px-4 py-2.5 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-12">
                  <Loader2 className="w-5 h-5 animate-spin inline" /> Memuat...
                </td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-600 py-12">Tidak ada transaksi ditemukan</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${tx.status === 'VOIDED' ? 'bg-red-950/20' : ''}`}>
                  <td className={`px-4 py-2.5 font-bold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-blue-400'}`}>
                    {tx.invoice_number}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 hidden sm:table-cell">{tx.kasir_name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{new Date(tx.created_at).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">
                    {tx.vehicle_plate ? `${tx.vehicle_plate} · ` : ''}{tx.vehicle_type}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-green-400'}`}>
                    {formatRupiah(tx.total)}
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tx.payment_method === 'CASH' ? 'bg-green-900/40 text-green-400' :
                      tx.payment_method === 'TRANSFER' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-purple-900/40 text-purple-400'
                    }`}>{tx.payment_method}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {tx.status === 'VOIDED'
                      ? <span className="px-2 py-0.5 bg-red-900/50 border border-red-800 text-red-400 text-[10px] font-bold rounded">VOID</span>
                      : <span className="px-2 py-0.5 bg-green-900/40 text-green-400 text-[10px] font-bold rounded">OK</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => setDetail(tx)}
                      className="text-gray-500 hover:text-blue-400 p-1.5 rounded hover:bg-blue-900/20 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Halaman {page} dari {totalPages} ({totalCount.toLocaleString('id-ID')} data)
            </p>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1} className="text-gray-400">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      page === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}>
                    {p}
                  </button>
                )
              })}
              <Button size="icon" variant="ghost" onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages} className="text-gray-400">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-bold">Detail Transaksi</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${detail.status === 'VOIDED' ? 'text-red-400' : 'text-blue-400'}`}>
                  {detail.invoice_number}
                </p>
                {detail.status === 'VOIDED' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-900/50 border border-red-800 text-red-400 text-xs font-bold rounded">
                    VOIDED
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {[
                  ['Kasir', detail.kasir_name],
                  ['Pelanggan', detail.customer_name ?? '-'],
                  ['Kendaraan', detail.vehicle_plate ? `${detail.vehicle_plate} (${detail.vehicle_type})` : detail.vehicle_type],
                  ['Tanggal', new Date(detail.created_at).toLocaleString('id-ID')],
                  ['Metode Bayar', detail.payment_method],
                  ['Bayar', formatRupiah(detail.payment_amount)],
                  ['Kembalian', formatRupiah(detail.change)],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-gray-500">{label as string}</span>
                    <span className="text-gray-200">{value as string}</span>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Layanan</p>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-200">{item.service_name}</p>
                      <p className="text-xs text-gray-500">{item.quantity}x {formatRupiah(item.price)}</p>
                    </div>
                    <span className="text-gray-300 font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t border-gray-800 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatRupiah(detail.subtotal)}</span></div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-red-400"><span>Diskon</span><span>-{formatRupiah(detail.discount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-white text-base border-t border-gray-700 pt-2">
                  <span>Total</span><span className="text-green-400">{formatRupiah(detail.total)}</span>
                </div>
              </div>

              {/* Void info */}
              {detail.status === 'VOIDED' && detail.void_reason && (
                <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Informasi Void</p>
                  <p className="text-xs text-gray-400">Alasan: {detail.void_reason}</p>
                  {detail.void_by_name && (
                    <p className="text-xs text-gray-400">Di-void oleh: {detail.void_by_name}</p>
                  )}
                  {detail.void_at && (
                    <p className="text-xs text-gray-400">Waktu: {new Date(detail.void_at).toLocaleString('id-ID')}</p>
                  )}
                </div>
              )}

              {/* Void button */}
              {detail.status === 'COMPLETED' && (
                <Button onClick={() => { setVoidTarget(detail); setDetail(null); setVoidConfirm1(true) }}
                  className="w-full bg-red-700 hover:bg-red-600 text-white border border-red-600">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Void Transaksi
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void Dialog 1 */}
      {voidConfirm1 && voidTarget && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="bg-red-900/30 w-14 h-14 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Konfirmasi Pembatalan</h3>
              <p className="text-sm text-gray-400 mt-2">
                Apakah Anda yakin ingin membatalkan transaksi<br />
                <span className="font-bold text-red-400">{voidTarget.invoice_number}</span> ?
              </p>
              <p className="text-xs text-red-400/70 mt-1">Total: {formatRupiah(voidTarget.total)}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setVoidConfirm1(false); setVoidTarget(null) }}
                variant="outline" className="flex-1 border-gray-700 text-gray-300">
                Tidak
              </Button>
              <Button onClick={() => { setVoidConfirm1(false); setVoidConfirm2(true) }}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white">
                Ya, Batalkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Void Dialog 2 */}
      {voidConfirm2 && voidTarget && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Alasan Void</h3>
              <button onClick={() => { setVoidConfirm2(false); setVoidTarget(null); setVoidReasonText('') }}
                className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Transaksi: <span className="font-bold text-red-400">{voidTarget.invoice_number}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Jenis Alasan</label>
                <select value={voidReasonType} onChange={(e) => setVoidReasonType(e.target.value as VoidReasonType)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
                  {VOID_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Keterangan (min. 20 karakter)</label>
                <textarea value={voidReasonText} onChange={(e) => setVoidReasonText(e.target.value)}
                  placeholder="Jelaskan alasan void secara detail..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-gray-500 resize-none" />
                <p className="text-xs text-gray-600 mt-1">{voidReasonText.length}/20 karakter</p>
              </div>
            </div>

            {voidError && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-lg">
                {voidError}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => { setVoidConfirm2(false); setVoidTarget(null); setVoidReasonText('') }}
                variant="outline" className="flex-1 border-gray-700 text-gray-300">
                Batal
              </Button>
              <Button onClick={handleVoid} disabled={voidLoading || voidReasonText.length < 20}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white">
                {voidLoading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Memproses...</> : 'Konfirmasi Void'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}