'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { Download, FileSpreadsheet, FileText, Loader2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom'
type Tab = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'CUSTOM'

interface ReportData {
  meta: { type: string; start: string; end: string }
  summary: {
    omzetKotor: number
    totalDiskon: number
    omzetBersih: number
    totalExpenses: number
    estimasiLaba: number
    totalTx: number
    totalVoid: number
    avgPerTx: number
    peakHour: { hour: number; count: number } | null
  }
  byService: { serviceId: string; name: string; count: number; omzet: number; pct: number }[]
  byKasir: { name: string; txCount: number; omzet: number; diskon: number; voidCount: number }[]
  byPayment: { method: string; amount: number; pct: number }[]
  byVehicle: { type: string; count: number; omzet: number }[]
  trend: { label: string; omzet: number; count: number }[]
  expenses: { id: string; amount: number; category: string; description: string; createdAt: string; inputBy: string }[]
  expenseByCategory: Record<string, number>
}

const PAYMENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6']
const VEHICLE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl lg:text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function getQuery(type: ReportType, extra: Record<string, string>) {
  const now = new Date()
  switch (type) {
    case 'daily': return `type=daily&date=${extra.date ?? now.toISOString().slice(0, 10)}`
    case 'weekly': return `type=weekly&week=${extra.week ?? `W${Math.ceil(now.getDate() / 7)}`}`
    case 'monthly': return `type=monthly&month=${extra.month ?? now.toISOString().slice(0, 7)}`
    case 'custom': return `type=custom&from=${extra.from ?? ''}&to=${extra.to ?? ''}`
  }
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('HARIAN')
  const [reportType] = useState<ReportType>('daily')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [week, setWeek] = useState(`W${Math.ceil(new Date().getDate() / 7)}`)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let url = `/api/reports?`
      const now = new Date()
      switch (tab) {
        case 'HARIAN': url += `type=daily&date=${date}`; break
        case 'MINGGUAN': url += `type=weekly&week=${new Date().getFullYear()}-${week}`; break
        case 'BULANAN': url += `type=monthly&month=${month}`; break
        case 'CUSTOM': url += `type=custom&from=${dateFrom}&to=${dateTo}`; break
      }
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal mengambil data')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [tab, date, week, month, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  async function handleExportExcel() {
    if (!data) return
    const XLSX = await import('xlsx')

    const wb = XLSX.utils.book_new()

    // Sheet 1: Ringkasan
    const summarySheet = [
      ['LAPORAN RINGKASAN'], [''],
      ['Periode', `${data.meta.start} s/d ${data.meta.end}`], [''],
      ['Total Omzet Kotor', data.summary.omzetKotor],
      ['Total Diskon', data.summary.totalDiskon],
      ['Omzet Bersih', data.summary.omzetBersih],
      ['Total Pengeluaran', data.summary.totalExpenses],
      ['Estimasi Laba Bersih', data.summary.estimasiLaba],
      ['Jumlah Transaksi', data.summary.totalTx],
      ['Transaksi Void', data.summary.totalVoid],
      ['Rata-rata per Transaksi', data.summary.avgPerTx],
      ...(data.summary.peakHour ? [['Peak Hour', `${data.summary.peakHour.hour}:00 (${data.summary.peakHour.count} transaksi)`]] : []),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summarySheet)
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan')

    // Sheet 2: Per Layanan
    const serviceRows: (string|number)[][] = [['Nama Layanan', 'Jumlah Terjual', 'Total Omzet', '%']]
    data.byService.forEach((s) => serviceRows.push([s.name, s.count, s.omzet, `${s.pct}%`]))
    const ws2 = XLSX.utils.aoa_to_sheet(serviceRows)
    XLSX.utils.book_append_sheet(wb, ws2, 'Per Layanan')

    // Sheet 3: Per Kasir
    const kasirRows: (string|number)[][] = [['Nama Kasir', 'Transaksi', 'Omzet', 'Diskon', 'Void']]
    data.byKasir.forEach((k) => kasirRows.push([k.name, k.txCount, k.omzet, k.diskon, k.voidCount]))
    const ws3 = XLSX.utils.aoa_to_sheet(kasirRows)
    XLSX.utils.book_append_sheet(wb, ws3, 'Per Kasir')

    // Sheet 4: Pengeluaran
    const expenseRows: (string|number)[][] = [['Tanggal', 'Kategori', 'Deskripsi', 'Jumlah', 'Input Oleh']]
    data.expenses.forEach((e) => expenseRows.push([e.createdAt, e.category, e.description, e.amount, e.inputBy]))
    const ws4 = XLSX.utils.aoa_to_sheet(expenseRows)
    XLSX.utils.book_append_sheet(wb, ws4, 'Pengeluaran')

    // Sheet 5: Metode Bayar & Kendaraan
    const paymentRows: (string|number)[][] = [['Metode Bayar', 'Jumlah', '%']]
    data.byPayment.forEach((p) => paymentRows.push([p.method, p.amount, Number(`${p.pct}%`)]))
    paymentRows.push([])
    paymentRows.push(['Jenis Kendaraan', 'Jumlah Unit', 'Omzet'])
    data.byVehicle.forEach((v) => paymentRows.push([v.type, v.count, v.omzet]))
    const ws5 = XLSX.utils.aoa_to_sheet(paymentRows)
    XLSX.utils.book_append_sheet(wb, ws5, 'Lainnya')

    XLSX.writeFile(wb, `laporan-${reportType}-${date}.xlsx`)
  }

  async function handleExportPDF() {
    if (!data) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape' })
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFontSize(14)
    doc.text('Laporan Keuangan CarWash', pageW / 2, 15, { align: 'center' })
    doc.setFontSize(9)
    doc.text(`Periode: ${data.meta.start.slice(0, 10)} s/d ${data.meta.end.slice(0, 10)}`, pageW / 2, 22, { align: 'center' })

    const summaryRows = [
      ['Omzet Kotor', formatRupiah(data.summary.omzetKotor)],
      ['Diskon', formatRupiah(data.summary.totalDiskon)],
      ['Omzet Bersih', formatRupiah(data.summary.omzetBersih)],
      ['Pengeluaran', formatRupiah(data.summary.totalExpenses)],
      ['Estimasi Laba', formatRupiah(data.summary.estimasiLaba)],
      ['Transaksi', `${data.summary.totalTx} (Void: ${data.summary.totalVoid})`],
      ['Rata-rata', formatRupiah(data.summary.avgPerTx)],
    ]
    // @ts-ignore
    doc.autoTable({
      head: [['Ringkasan Finansial', '']],
      body: summaryRows,
      startY: 28,
      styles: { fontSize: 9 },
    })

    if (data.byService.length > 0) {
      // @ts-ignore
      doc.autoTable({
        head: [['Layanan', 'Qty', 'Omzet', '%']],
        body: data.byService.map((s) => [s.name, s.count, formatRupiah(s.omzet), `${s.pct}%`]),
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
        styles: { fontSize: 8 },
      })
    }

    if (data.expenses.length > 0) {
      // @ts-ignore
      doc.autoTable({
        head: [['Tanggal', 'Kategori', 'Deskripsi', 'Jumlah', 'Input Oleh']],
        body: data.expenses.map((e) => [e.createdAt.slice(0, 10), e.category, e.description, formatRupiah(e.amount), e.inputBy]),
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
        styles: { fontSize: 8 },
      })
    }

    doc.setFontSize(8)
    doc.text(
      `Dicetak: ${new Date().toLocaleString('id-ID')} | CarWash Manager`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
    doc.save(`laporan-${reportType}-${date}.pdf`)
  }

  const s = data?.summary
  const PIE_DATA = data?.byPayment.map((p) => ({ name: p.method, value: p.amount })) ?? []
  const VEHICLE_DATA = data?.byVehicle.map((v) => ({ name: v.type, value: v.count })) ?? []

  return (
    <div className="space-y-4">
      {/* Header + Export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Laporan Keuangan</h1>
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

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit">
        {(['HARIAN', 'MINGGUAN', 'BULANAN', 'CUSTOM'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {tab === 'HARIAN' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5" />
            </div>
          )}
          {tab === 'MINGGUAN' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Minggu ke-</label>
              <input type="week" value={`${new Date().getFullYear()}-${week}`} onChange={(e) => setWeek(e.target.value.split('-W')[1] ?? '1')}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5" />
            </div>
          )}
          {tab === 'BULANAN' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bulan</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5" />
            </div>
          )}
          {tab === 'CUSTOM' && (
            <>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dari</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Sampai</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5" />
              </div>
            </>
          )}
          <Button onClick={loadData} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            Tampilkan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat laporan...
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Omzet Kotor" value={formatRupiah(s?.omzetKotor ?? 0)} color="text-green-400" />
            <StatCard label="Total Diskon" value={formatRupiah(s?.totalDiskon ?? 0)} color="text-orange-400" sub={`${data.summary.totalVoid} void`} />
            <StatCard label="Pengeluaran" value={formatRupiah(s?.totalExpenses ?? 0)} color="text-red-400" />
            <StatCard label="Estimasi Laba" value={formatRupiah(s?.estimasiLaba ?? 0)}
              color={(s?.estimasiLaba ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Transaksi" value={`${s?.totalTx ?? 0}`} sub={`Void: ${s?.totalVoid ?? 0}`} />
            <StatCard label="Rata-rata/Tx" value={formatRupiah(s?.avgPerTx ?? 0)} />
            <StatCard label="Peak Hour"
              value={s?.peakHour ? `${s.peakHour.hour.toString().padStart(2, '0')}:00` : '-'}
              sub={s?.peakHour ? `${s.peakHour.count} transaksi` : 'Tidak ada data'} />
          </div>

          {/* Charts + Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Trend Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" /> Tren
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}rb`} />
                  <Tooltip formatter={(value) => [formatRupiah(value as number), 'Omzet']}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 11 }} />
                  <Bar dataKey="omzet" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Payment Breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Metode Pembayaran</h3>
              {PIE_DATA.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                      paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {PIE_DATA.map((_, i) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[180px] flex items-center justify-center text-gray-500 text-sm">Tidak ada data</div>}
            </div>
          </div>

          {/* By Vehicle */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Breakdown per Jenis Kendaraan</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.byVehicle.map((v, i) => (
                <div key={v.type} className="bg-gray-800 rounded-lg p-3 border-l-4"
                  style={{ borderColor: VEHICLE_COLORS[i % VEHICLE_COLORS.length] }}>
                  <p className="text-gray-400 text-xs">{v.type}</p>
                  <p className="text-lg font-bold text-white">{v.count} unit</p>
                  <p className="text-green-400 text-sm">{formatRupiah(v.omzet)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* By Service Table */}
          {data.byService.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Breakdown per Layanan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Layanan</th>
                      <th className="text-right px-4 py-2.5 font-medium">Terjual</th>
                      <th className="text-right px-4 py-2.5 font-medium">Total Omzet</th>
                      <th className="text-right px-4 py-2.5 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byService.map((s) => (
                      <tr key={s.serviceId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-gray-200">{s.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{s.count}x</td>
                        <td className="px-4 py-2.5 text-right text-green-400 font-semibold">{formatRupiah(s.omzet)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{s.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Kasir Table */}
          {data.byKasir.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Breakdown per Kasir</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Nama Kasir</th>
                      <th className="text-right px-4 py-2.5 font-medium">Transaksi</th>
                      <th className="text-right px-4 py-2.5 font-medium">Omzet</th>
                      <th className="text-right px-4 py-2.5 font-medium">Diskon</th>
                      <th className="text-right px-4 py-2.5 font-medium">Void</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byKasir.map((k) => (
                      <tr key={k.name} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-gray-200">{k.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{k.txCount}</td>
                        <td className="px-4 py-2.5 text-right text-green-400 font-semibold">{formatRupiah(k.omzet)}</td>
                        <td className="px-4 py-2.5 text-right text-orange-400">{formatRupiah(k.diskon)}</td>
                        <td className="px-4 py-2.5 text-right text-red-400">{k.voidCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenses Table */}
          {data.expenses.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Pengeluaran</h3>
                <span className="text-sm font-bold text-red-400">{formatRupiah(data.summary.totalExpenses)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Tanggal</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Kategori</th>
                      <th className="text-left px-4 py-2.5 font-medium">Deskripsi</th>
                      <th className="text-right px-4 py-2.5 font-medium">Jumlah</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Input Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-gray-400">{new Date(e.createdAt).toLocaleDateString('id-ID')}</td>
                        <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell">
                          <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">{e.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-200">{e.description}</td>
                        <td className="px-4 py-2.5 text-right text-red-400 font-semibold">{formatRupiah(e.amount)}</td>
                        <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{e.inputBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
