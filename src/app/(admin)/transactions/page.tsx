'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  Search, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Eye, X,
  Filter, AlertTriangle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ──────────────────────────────────────────────────────────────
interface TxItem {
  id: string
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}

interface Transaction {
  id: string
  invoiceNumber: string
  kasirId: string
  kasir: { id: string; name: string }
  platNomor: string
  customerName: string | null
  vehicleType: 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS'
  subtotal: number
  discount: number
  total: number
  paymentAmount: number
  change: number
  status: 'COMPLETED' | 'VOIDED'
  voidReason: string | null
  createdAt: string
  items: TxItem[]
}

const PER_PAGE = 20

export default function TransactionsPage() {
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [search, setSearch] = useState('')

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)

  // Detail modal
  const [detail, setDetail] = useState<Transaction | null>(null)

  // Void flow
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null)
  const [voidConfirm1, setVoidConfirm1] = useState(false)
  const [voidConfirm2, setVoidConfirm2] = useState(false)
  const [voidReasonType, setVoidReasonType] = useState('SALAH_INPUT')
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

  // Load transactions from API
  const loadTx = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PER_PAGE),
    })
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (status) params.set('status', status)
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTransactions(data.transactions ?? [])
      setTotalCount(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (e) {
      console.error('Load tx error:', e)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, status, search, page])

  useEffect(() => { loadTx() }, [loadTx])

  async function handleVoid() {
    if (!voidTarget) return
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

      showNotification(`Transaksi ${voidTarget.invoiceNumber} berhasil dibatalkan.`)
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
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '500',
      })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (status) params.set('status', status)
      if (search) params.set('search', search)

      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) break
      const data = await res.json()
      if (!data.transactions?.length) { hasMore = false; break }
      allData.push(...data.transactions)
      if (data.transactions.length < 500) { hasMore = false }
      currentPage++
    }

    const sheet = allData.map((t: Record<string, unknown>, i: number) => ({
      No: i + 1,
      Invoice: t.invoiceNumber,
      Tanggal: new Date(t.createdAt as string).toLocaleString('id-ID'),
      Kasir: (t.kasir as Record<string, unknown>)?.name ?? '-',
      Pelanggan: t.customerName ?? '-',
      Kendaraan: `${t.platNomor ?? '-'} (${t.vehicleType})`,
      'Metode Bayar': t.paymentMethod,
      Subtotal: t.subtotal,
      Diskon: t.discount,
      Total: t.total,
      Bayar: t.paymentAmount,
      Kembalian: t.change,
      Status: t.status,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheet)
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
    XLSX.writeFile(wb, `transaksi-${dateFrom}-${dateTo}.xlsx`)
  }

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
        <Button onClick={handleExportExcel} variant="outline" size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
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
            <label className="text-xs text-gray-500 mb-1 block">Metode Bayar</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
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
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Plat No</th>
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
                    {tx.invoiceNumber}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 hidden sm:table-cell">{tx.platNomor || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-400">{new Date(tx.createdAt).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">{tx.platNomor ? `${tx.platNomor} · ` : ''}{tx.vehicleType}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-green-400'}`}>
                    {formatRupiah(tx.total)}
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tx.paymentMethod === 'CASH' ? 'bg-green-900/40 text-green-400' :
                      tx.paymentMethod === 'TRANSFER' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-purple-900/40 text-purple-400'
                    }`}>{tx.paymentMethod}</span>
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
              <button onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1} className="w-8 h-8 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 mx-auto" />
              </button>
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
              <button onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages} className="w-8 h-8 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30">
                <ChevronRight className="w-4 h-4 mx-auto" />
              </button>
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
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${detail.status === 'VOIDED' ? 'text-red-400' : 'text-blue-400'}`}>
                  {detail.invoiceNumber}
                </p>
                {detail.status === 'VOIDED' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-900/50 border border-red-800 text-red-400 text-xs font-bold rounded">VOIDED</span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {[
                  ['Kasir', detail.kasir?.name ?? '-'],
                  ['Pelanggan', detail.customerName ?? '-'],
                  ['Plat No', detail.platNomor || '-'],
                  ['Kendaraan', detail.vehicleType],
                  ['Tanggal', new Date(detail.createdAt).toLocaleString('id-ID')],
                  ['Metode Bayar', detail.paymentMethod],
                  ['Bayar', formatRupiah(detail.paymentAmount)],
                  ['Kembalian', formatRupiah(detail.change)],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-gray-500">{label as string}</span>
                    <span className="text-gray-200">{value as string}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Layanan</p>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-200">{item.serviceName}</p>
                      <p className="text-xs text-gray-500">{item.quantity}x {formatRupiah(item.price)}</p>
                    </div>
                    <span className="text-gray-300 font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatRupiah(detail.subtotal)}</span></div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-red-400"><span>Diskon</span><span>-{formatRupiah(detail.discount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-white text-base border-t border-gray-700 pt-2">
                  <span>Total</span><span className="text-green-400">{formatRupiah(detail.total)}</span>
                </div>
              </div>

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
                <span className="font-bold text-red-400">{voidTarget.invoiceNumber}</span> ?
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
              Transaksi: <span className="font-bold text-red-400">{voidTarget.invoiceNumber}</span>
            </p>

            <div className="space-y-3">
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