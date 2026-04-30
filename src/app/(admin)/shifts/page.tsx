'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  Clock, Loader2, Filter, Eye,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────
interface ShiftSummary {
  id: string
  kasirId: string
  openingCash: number
  closingCash: number | null
  expectedCash: number | null
  actualCash: number | null
  difference: number | null
  status: 'OPEN' | 'CLOSED'
  note: string | null
  openedAt: string
  closedAt: string | null
  kasir: { id: string; name: string }
  _count: { transactions: number }
  totalOmzet?: number
  cashTotal?: number
}

interface ShiftDetail extends ShiftSummary {
  transactions: {
    id: string
    invoiceNumber: string
    total: number
    paymentMethod: string
    status: string
    createdAt: string
  }[]
  expenses: {
    id: string
    description: string
    amount: number
    category: string
  }[]
}

interface FilterKasir { id: string; name: string }

// ── Component ────────────────────────────────────────────────────────────
export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftSummary[]>([])
  const [kasirs, setKasirs] = useState<FilterKasir[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10))
  const [filterKasir, setFilterKasir] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  // Detail modal
  const [detailShift, setDetailShift] = useState<ShiftDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('from', filterFrom)
      params.set('to', filterTo)
      if (filterKasir !== 'ALL') params.set('kasirId', filterKasir)
      if (filterStatus !== 'ALL') params.set('status', filterStatus)

      const res = await fetch(`/api/shifts?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setShifts(json.shifts ?? [])
      setKasirs(json.kasirs ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterKasir, filterStatus])

  useEffect(() => { loadData() }, [loadData])

  async function openDetail(shift: ShiftSummary) {
    setDetailLoading(true)
    setDetailShift(null)
    try {
      const res = await fetch(`/api/shifts/${shift.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDetailShift(json.shift)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const totalOmzet = shifts.reduce((s, sh) => s + (sh.totalOmzet ?? 0), 0)
  const shiftClosed = shifts.filter((s) => s.status === 'CLOSED')
  const shiftWithDiff = shiftClosed.filter((s) => s.difference !== 0)
  const totalDiff = shiftWithDiff.reduce((s, sh) => s + (sh.difference ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Riwayat Shift
        </h1>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Shift</p>
            <p className="text-2xl font-bold text-white">{shifts.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Omzet</p>
            <p className="text-xl font-bold text-green-400">{formatRupiah(totalOmzet)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Shift Ditutup</p>
            <p className="text-2xl font-bold text-blue-400">{shiftClosed.length}</p>
          </div>
          <div className={`bg-gray-900 border rounded-xl p-4 ${totalDiff !== 0 ? 'border-yellow-700' : 'border-gray-800'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Selisih</p>
            <p className={`text-xl font-bold ${totalDiff === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {totalDiff === 0 ? 'Sesuai' : formatRupiah(totalDiff)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dari Tanggal</label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-sm w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sampai Tanggal</label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-sm w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Kasir</label>
            <Select value={filterKasir} onValueChange={(v) => setFilterKasir(v ?? 'ALL')}>
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kasir</SelectItem>
                {kasirs.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus((v ?? 'ALL') as 'ALL' | 'OPEN' | 'CLOSED')}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadData} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            <Filter className="w-4 h-4 mr-1" /> Tampilkan
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium">Kasir</th>
                  <th className="text-right px-4 py-3 font-medium">Kas Awal</th>
                  <th className="text-right px-4 py-3 font-medium">Omzet</th>
                  <th className="text-right px-4 py-3 font-medium">Kas Expected</th>
                  <th className="text-right px-4 py-3 font-medium">Kas Actual</th>
                  <th className="text-right px-4 py-3 font-medium">Selisih</th>
                  <th className="text-center px-4 py-3 font-medium">Tx</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-gray-600 py-10">Belum ada data shift</td></tr>
                ) : shifts.map((sh) => {
                  const hasDiff = sh.difference !== 0 && sh.difference !== null
                  const diffColor = hasDiff ? (sh.difference! > 0 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'
                  return (
                    <tr key={sh.id}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer ${hasDiff ? 'bg-yellow-950/10' : ''}`}
                      onClick={() => openDetail(sh)}>
                      <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                        {new Date(sh.openedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-white">{sh.kasir.name}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatRupiah(sh.openingCash)}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-semibold">{formatRupiah(sh.totalOmzet ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{sh.expectedCash != null ? formatRupiah(sh.expectedCash) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{sh.actualCash != null ? formatRupiah(sh.actualCash) : '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${diffColor}`}>
                        {sh.difference != null ? (sh.difference > 0 ? '+' : '') + formatRupiah(sh.difference) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">{sh._count?.transactions ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        {sh.status === 'OPEN' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800 font-medium">OPEN</span>
                        ) : hasDiff ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700 font-medium flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3" /> SELISIH
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400 border border-green-800 font-medium flex items-center gap-1 w-fit mx-auto">
                            <CheckCircle className="w-3 h-3" /> CLOSED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Eye className="w-4 h-4 text-gray-500 hover:text-white inline" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailShift || detailLoading} onOpenChange={() => setDetailShift(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Detail Shift
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : detailShift && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Kasir</p>
                  <p className="text-white font-medium">{detailShift.kasir.name}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Buka</p>
                  <p className="text-white">{new Date(detailShift.openedAt).toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Tutup</p>
                  <p className="text-white">{detailShift.closedAt ? new Date(detailShift.closedAt).toLocaleString('id-ID') : '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Kas Awal</p>
                  <p className="text-white">{formatRupiah(detailShift.openingCash)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Kas Actual</p>
                  <p className={`font-semibold ${detailShift.difference !== 0 ? 'text-yellow-400' : 'text-white'}`}>
                    {detailShift.actualCash != null ? formatRupiah(detailShift.actualCash) : '—'}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${detailShift.status === 'OPEN' ? 'bg-blue-900/50 text-blue-400' : 'bg-green-900/50 text-green-400'}`}>
                    {detailShift.status}
                  </span>
                </div>
              </div>

              {/* Cash Reconciliation */}
              {detailShift.status === 'CLOSED' && (
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Rekonsiliasi Kas</p>
                  {[
                    ['Kas Awal', detailShift.openingCash],
                    ['Total Cash Tx', detailShift.cashTotal ?? 0],
                    ['Expected Kas', detailShift.expectedCash ?? 0],
                    ['Actual Kas', detailShift.actualCash ?? 0],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-white font-mono">{formatRupiah(val as number)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-800 pt-2 mt-2 flex items-center justify-between">
                    <span className="text-gray-400 font-semibold">Selisih</span>
                    <span className={`font-bold font-mono text-lg ${
                      (detailShift.difference ?? 0) === 0 ? 'text-green-400' : (detailShift.difference! > 0 ? 'text-yellow-400' : 'text-red-400')
                    }`}>
                      {(detailShift.difference ?? 0) === 0 ? 'SESUAI ✓' : (
                        `${(detailShift.difference! > 0 ? '+' : '-')} ${formatRupiah(Math.abs(detailShift.difference ?? 0))}`
                      )}
                    </span>
                  </div>
                  {detailShift.note && (
                    <div className="flex items-start gap-2 pt-1">
                      <span className="text-gray-500 text-xs">Catatan:</span>
                      <span className="text-gray-300 text-xs italic">{detailShift.note}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Transactions */}
              {detailShift.transactions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Transaksi ({detailShift.transactions.length})
                  </p>
                  <div className="bg-gray-950 rounded-lg divide-y divide-gray-800">
                    {detailShift.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div>
                          <span className="text-gray-300 font-mono">{tx.invoiceNumber}</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${tx.status === 'COMPLETED' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-semibold">{formatRupiah(tx.total)}</p>
                          <p className="text-gray-500">{tx.paymentMethod}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {detailShift.expenses.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Pengeluaran ({detailShift.expenses.length})
                  </p>
                  <div className="bg-gray-950 rounded-lg divide-y divide-gray-800">
                    {detailShift.expenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div>
                          <span className="text-gray-300">{e.description}</span>
                          <span className="ml-2 text-gray-500 text-[10px]">{e.category}</span>
                        </div>
                        <span className="text-red-400">{formatRupiah(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
