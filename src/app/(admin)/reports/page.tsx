'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PieChart, Pie, Legend } from 'recharts'
import { FileSpreadsheet, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Tab = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'CUSTOM'

interface ReportData {
  meta: { type: string; start: string; end: string }
  summary: {
    omzetKotor: number; totalDiskon: number; omzetBersih: number; totalTx: number
    totalVoid: number; avgPerTx: number; peakHour: { hour: number; count: number } | null
  }
  byService: { serviceId: string; name: string; count: number; omzet: number; pct: number }[]
  byPayment: { method: string; amount: number; pct: number }[]
  byVehicle: { type: string; count: number; omzet: number }[]
  trend: { label: string; omzet: number; count: number }[]
}

const PAYMENT_COLORS = ['#059669', '#2563eb', '#d97706']
const VEHICLE_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626']

function StatCard({ label, value, sub, color = 'text-foreground' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <p className="stat-label">{label}</p>
      <p className={`text-xl lg:text-2xl font-bold ${color} mt-1`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('HARIAN')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [week, setWeek] = useState(`W${Math.ceil(new Date().getDate() / 7)}`)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      let url = '/api/reports?'
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
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [tab, date, week, month, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  async function handleExportExcel() {
    if (!data) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const summarySheet = [
      ['LAPORAN KEUANGAN CARWASH'], [''],
      ['Periode', `${data.meta.start} s/d ${data.meta.end}`], [''],
      ['Total Omzet Kotor', data.summary.omzetKotor], ['Total Diskon', data.summary.totalDiskon],
      ['Omzet Bersih', data.summary.omzetBersih], ['Jumlah Transaksi', data.summary.totalTx],
      ['Transaksi Void', data.summary.totalVoid], ['Rata-rata per Transaksi', data.summary.avgPerTx],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summarySheet)
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan')

    const serviceRows: (string|number)[][] = [['Nama Layanan', 'Jumlah Terjual', 'Total Omzet', '%']]
    data.byService.forEach((s) => serviceRows.push([s.name, s.count, s.omzet, `${s.pct}%`]))
    const ws2 = XLSX.utils.aoa_to_sheet(serviceRows)
    XLSX.utils.book_append_sheet(wb, ws2, 'Per Layanan')

    const paymentRows: (string|number)[][] = [['Metode Bayar', 'Jumlah', '%']]
    data.byPayment.forEach((p) => paymentRows.push([p.method, p.amount, Number(`${p.pct}%`)]))
    paymentRows.push([])
    paymentRows.push(['Jenis Kendaraan', 'Jumlah Unit', 'Omzet'])
    data.byVehicle.forEach((v) => paymentRows.push([v.type, v.count, v.omzet]))
    const ws3 = XLSX.utils.aoa_to_sheet(paymentRows)
    XLSX.utils.book_append_sheet(wb, ws3, 'Lainnya')

    XLSX.writeFile(wb, `laporan-${date}.xlsx`)
  }

  const s = data?.summary
  const PIE_DATA = data?.byPayment.map((p) => ({ name: p.method, value: p.amount })) ?? []
  const VEHICLE_DATA = data?.byVehicle.map((v) => ({ name: v.type, value: v.count })) ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Laporan Keuangan</h1>
        <Button onClick={handleExportExcel} size="sm" variant="outline" className="border-border">
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Export Excel
        </Button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-accent p-1 rounded-xl w-fit">
        {(['HARIAN', 'MINGGUAN', 'BULANAN', 'CUSTOM'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}>{t}</button>
        ))}
      </div>

      {/* Date Inputs */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          {tab === 'HARIAN' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          )}
          {tab === 'MINGGUAN' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Minggu ke-</label>
              <input type="week" value={`${new Date().getFullYear()}-${week}`}
                onChange={(e) => setWeek(e.target.value.split('-W')[1] ?? '1')}
                className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          )}
          {tab === 'BULANAN' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bulan</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          )}
          {tab === 'CUSTOM' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Dari</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sampai</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </>
          )}
          <Button onClick={loadData} size="sm" className="btn-primary">
            Tampilkan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat laporan...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Omzet Kotor" value={formatRupiah(s?.omzetKotor ?? 0)} color="text-emerald-600" />
            <StatCard label="Total Diskon" value={formatRupiah(s?.totalDiskon ?? 0)} color="text-orange-500" sub={`${data.summary.totalVoid} void`} />
            <StatCard label="Omzet Bersih" value={formatRupiah(s?.omzetBersih ?? 0)} color="text-emerald-600" />
            <StatCard label="Transaksi" value={`${s?.totalTx ?? 0}`} sub={`Void: ${s?.totalVoid ?? 0}`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Rata-rata/Tx" value={formatRupiah(s?.avgPerTx ?? 0)} />
            <StatCard label="Peak Hour"
              value={s?.peakHour ? `${s.peakHour.hour.toString().padStart(2, '0')}:00` : '-'}
              sub={s?.peakHour ? `${s.peakHour.count} transaksi` : 'Tidak ada data'} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card px-5 py-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Tren
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}rb`} />
                  <Tooltip formatter={(value) => [formatRupiah(value as number), 'Omzet']}
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1a1d2e', fontSize: 11 }}
                    cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="omzet" fill="#2563eb" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card px-5 py-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Metode Pembayaran</h3>
              {PIE_DATA.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                      paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {PIE_DATA.map((_, i) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Tidak ada data</div>
              )}
            </div>
          </div>

          {/* Vehicle Breakdown */}
          {VEHICLE_DATA.length > 0 && (
            <div className="card px-5 py-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Breakdown per Jenis Kendaraan</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {data.byVehicle.map((v, i) => (
                  <div key={v.type} className="bg-accent rounded-xl p-3 border-l-4" style={{ borderColor: VEHICLE_COLORS[i % VEHICLE_COLORS.length] }}>
                    <p className="text-muted-foreground text-xs">{v.type}</p>
                    <p className="text-lg font-bold text-foreground">{v.count} unit</p>
                    <p className="text-emerald-600 text-sm font-semibold">{formatRupiah(v.omzet)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Breakdown */}
          {data.byService.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Breakdown per Layanan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 font-medium">Layanan</th>
                      <th className="text-right px-4 py-3 font-medium">Terjual</th>
                      <th className="text-right px-4 py-3 font-medium">Total Omzet</th>
                      <th className="text-right px-4 py-3 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byService.map((sv) => (
                      <tr key={sv.serviceId} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="px-5 py-3 text-foreground">{sv.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{sv.count}x</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatRupiah(sv.omzet)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{sv.pct}%</td>
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