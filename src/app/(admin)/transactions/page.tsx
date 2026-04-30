'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  Search, FileSpreadsheet,
  ChevronLeft, ChevronRight, Eye, X,
  Filter, AlertTriangle, Loader2, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TxItem { id: string; serviceName: string; price: number; quantity: number; subtotal: number }

interface Transaction {
  id: string; invoiceNumber: string; kasirId: string; kasir: { id: string; name: string }
  platNomor: string; customerName: string | null; vehicleType: 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS'
  subtotal: number; discount: number; total: number
  paymentAmount: number; change: number
  status: 'COMPLETED' | 'VOIDED'; voidReason: string | null; createdAt: string; items: TxItem[]
}

const PER_PAGE = 20

export default function TransactionsPage() {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('')
  const [status, setStatus] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [search, setSearch] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [detail, setDetail] = useState<Transaction | null>(null)
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
    setToastMsg(msg); setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const loadTx = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (paymentMethod) params.set('paymentMethod', paymentMethod)
      if (status) params.set('status', status)
    if (vehicleType) params.set('vehicleType', vehicleType)
    if (search) params.set('search', search)
    try {
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTransactions(data.transactions ?? [])
      setTotalCount(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (e) { console.error('Load tx error:', e) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo, status, vehicleType, search, page])

  useEffect(() => { loadTx() }, [loadTx])

  async function handleVoid() {
    if (!voidTarget) return
    if (voidReasonText.length < 20) { setVoidError('Alasan void minimal 20 karakter.'); return }
    setVoidLoading(true); setVoidError('')
    try {
      const res = await fetch(`/api/transactions/${voidTarget.id}/void`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonType: voidReasonType, reason: voidReasonText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal void transaksi')
      showNotification(`Transaksi ${voidTarget.invoiceNumber} berhasil dibatalkan.`)
      setVoidConfirm2(false); setVoidTarget(null); setVoidConfirm1(false)
      setVoidReasonText(''); setVoidReasonType('SALAH_INPUT')
      await loadTx()
    } catch (err) { setVoidError(err instanceof Error ? err.message : 'Gagal void transaksi.') }
    finally { setVoidLoading(false) }
  }

  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const allData: Record<string, unknown>[] = []
    let currentPage = 1, hasMore = true
    while (hasMore) {
      const params = new URLSearchParams({ page: String(currentPage), limit: '500' })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (status) params.set('status', status)
      if (search) params.set('search', search)
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) break
      const data = await res.json()
      if (!data.transactions?.length) { hasMore = false; break }
      allData.push(...data.transactions)
      if (data.transactions.length < 500) hasMore = false
      currentPage++
    }
    const sheet = allData.map((t: Record<string, unknown>, i: number) => ({
      No: i + 1, Invoice: t.invoiceNumber,
      Tanggal: new Date(t.createdAt as string).toLocaleString('id-ID'),
      Kasir: (t.kasir as Record<string, unknown>)?.name ?? '-',
      Pelanggan: t.customerName ?? '-',
      Kendaraan: `${t.platNomor ?? '-'} (${t.vehicleType})`,
      'Metode Bayar': t.paymentMethod, Subtotal: t.subtotal, Diskon: t.discount,
      Total: t.total, Bayar: t.paymentAmount, Kembalian: t.change, Status: t.status,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheet)
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
    XLSX.writeFile(wb, `transaksi-${dateFrom}-${dateTo}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {showToast && (
        <div className="fixed top-4 right-4 z-[100] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white" />{toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transaksi</h1>
          <p className="text-sm text-muted-foreground">{totalCount.toLocaleString('id-ID')} transaksi ditemukan</p>
        </div>
        <Button onClick={handleExportExcel} size="sm" variant="outline" className="border-border">
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Export Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="card px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Metode Bayar</label>
            <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }}
              className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">Semua</option>
              <option value="CASH">CASH</option><option value="TRANSFER">TRANSFER</option><option value="QRIS">QRIS</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">Semua</option>
              <option value="COMPLETED">COMPLETED</option><option value="VOIDED">VOIDED</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Kendaraan</label>
            <select value={vehicleType} onChange={(e) => { setVehicleType(e.target.value); setPage(1) }}
              className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">Semua</option>
              <option value="MOTOR">MOTOR</option><option value="MOBIL">MOBIL</option><option value="PICKUP">PICKUP</option><option value="TRUK">TRUK</option>
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari invoice atau plat nomor..."
            className="w-full bg-background border border-border text-foreground text-sm rounded-lg pl-9 pr-4 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Plat No</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal & Jam</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Kendaraan</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Metode</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-12">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Memuat...
                </td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-12">Tidak ada transaksi ditemukan</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id}
                  className={`border-b border-border/50 hover:bg-accent/50 transition-colors ${tx.status === 'VOIDED' ? 'bg-red-50/40' : ''}`}>
                  <td className={`px-5 py-3 font-bold ${tx.status === 'VOIDED' ? 'text-red-500 line-through' : 'text-primary'}`}>
                    {tx.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-foreground hidden sm:table-cell">{tx.platNomor || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{tx.platNomor ? `${tx.platNomor} · ` : ''}{tx.vehicleType}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-emerald-600'}`}>
                    {formatRupiah(tx.total)}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      tx.paymentMethod === 'CASH' ? 'badge-green' : tx.paymentMethod === 'TRANSFER' ? 'badge-blue' : 'badge-yellow'
                    }`}>{tx.paymentMethod}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.status === 'VOIDED'
                      ? <span className="badge-red">VOID</span>
                      : <span className="badge-green">OK</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDetail(tx)}
                      className="text-primary hover:text-primary/80 p-1.5 rounded hover:bg-blue-50 transition-colors">
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Halaman {page} dari {totalPages} ({totalCount.toLocaleString('id-ID')} data)</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-8 h-8 rounded text-xs text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4 mx-auto" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                    page === i + 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  }`}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded text-xs text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Detail Transaksi</h3>
              <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
                <X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-accent rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${detail.status === 'VOIDED' ? 'text-red-500' : 'text-primary'}`}>{detail.invoiceNumber}</p>
                {detail.status === 'VOIDED' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">VOIDED</span>)}
              </div>
              <div className="space-y-2 text-sm">
                {[['Kasir', detail.kasir?.name ?? '-'], ['Pelanggan', detail.customerName ?? '-'],
                  ['Plat No', detail.platNomor || '-'], ['Kendaraan', detail.vehicleType],
                  ['Tanggal', new Date(detail.createdAt).toLocaleString('id-ID')],
                  ['Metode Bayar', detail.paymentMethod],
                  ['Bayar', formatRupiah(detail.paymentAmount)],
                  ['Kembalian', formatRupiah(detail.change)]].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="text-foreground font-medium">{value as string}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layanan</p>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div><p className="text-foreground">{item.serviceName}</p><p className="text-muted-foreground text-xs">{item.quantity}x {formatRupiah(item.price)}</p></div>
                    <span className="text-foreground font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{formatRupiah(detail.subtotal)}</span></div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-red-500"><span>Diskon</span><span>-{formatRupiah(detail.discount)}</span></div>)}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span>Total</span><span className="text-emerald-600">{formatRupiah(detail.total)}</span>
                </div>
              </div>
              {detail.status === 'COMPLETED' && (
                <Button onClick={() => { setVoidTarget(detail); setDetail(null); setVoidConfirm1(true) }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Void Transaksi
                </Button>)}
            </div>
          </div>
        </div>
      )}

      {/* Void Dialog 1 */}
      {voidConfirm1 && voidTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-4 text-center">
            <div className="bg-red-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" /></div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Konfirmasi Pembatalan</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Batalkan transaksi <span className="font-bold text-red-500">{voidTarget.invoiceNumber}</span> ?
              </p>
              <p className="text-xs text-red-400 mt-1">Total: {formatRupiah(voidTarget.total)}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setVoidConfirm1(false); setVoidTarget(null) }} variant="outline" className="flex-1">Tidak</Button>
              <Button onClick={() => { setVoidConfirm1(false); setVoidConfirm2(true) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">Ya, Batalkan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Void Dialog 2 */}
      {voidConfirm2 && voidTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Alasan Void</h3>
              <button onClick={() => { setVoidConfirm2(false); setVoidTarget(null); setVoidReasonText('') }}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">Transaksi: <span className="font-bold text-red-500">{voidTarget.invoiceNumber}</span></p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Keterangan (min. 20 karakter)</label>
              <textarea value={voidReasonText} onChange={(e) => setVoidReasonText(e.target.value)}
                placeholder="Jelaskan alasan void secara detail..."
                rows={3}
                className="w-full bg-background border border-border text-foreground text-sm rounded-xl px-3 py-2.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
              <p className="text-xs text-muted-foreground mt-1">{voidReasonText.length}/20 karakter</p>
            </div>
            {voidError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-xl">{voidError}</div>)}
            <div className="flex gap-3">
              <Button onClick={() => { setVoidConfirm2(false); setVoidTarget(null); setVoidReasonText('') }}
                variant="outline" className="flex-1">Batal</Button>
              <Button onClick={handleVoid} disabled={voidLoading || voidReasonText.length < 20}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {voidLoading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Memproses...</> : 'Konfirmasi Void'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
