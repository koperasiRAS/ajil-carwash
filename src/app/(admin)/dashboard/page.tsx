'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatRupiah } from '@/lib/invoice'
import {
  TrendingUp,
  Receipt,
  X,
  ArrowUp,
  Plus,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PieChart, Pie, Cell as PieCell, Legend, ResponsiveContainer as PC } from 'recharts'
import { Button } from '@/components/ui/button'

type VehicleType = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'

interface TxItem {
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}

interface Transaction {
  id: string
  invoiceNumber: string
  kasirId: string
  platNomor: string
  customerName?: string
  vehicleType: VehicleType
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS'
  subtotal: number
  discount: number
  total: number
  paymentAmount: number
  change: number
  status: 'COMPLETED' | 'VOIDED'
  createdAt: string
  items: TxItem[]
  kasir?: { id: string; name: string }
}

interface DayOmzet {
  date: string
  label: string
  omzet: number
}

function formatJam(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626']

export default function DashboardPage() {
  const [todayKey, setTodayKey] = useState(() => new Date().toISOString().slice(0, 10))
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [weekOmzet, setWeekOmzet] = useState<DayOmzet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const todayTx = transactions.filter((t) => t.status === 'COMPLETED')
  const omzetToday = todayTx.reduce((s, t) => s + t.total, 0)
  const txCount = todayTx.length
  const txMotor = todayTx.filter((t) => t.vehicleType === 'MOTOR').length
  const txMobil = todayTx.filter((t) => t.vehicleType === 'MOBIL').length
  const txOther = todayTx.filter((t) => !['MOTOR', 'MOBIL'].includes(t.vehicleType)).length

  const vehicleBreakdown = [
    { name: 'Motor', value: txMotor },
    { name: 'Mobil', value: txMobil },
    { name: 'Pickup', value: todayTx.filter((t) => t.vehicleType === 'PICKUP').length },
    { name: 'Truk', value: todayTx.filter((t) => t.vehicleType === 'TRUK').length },
  ].filter((d) => d.value > 0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions?page=1&limit=100')
      if (!res.ok) return
      const data = await res.json()
      const txList: Transaction[] = data.transactions ?? []
      setTransactions(txList)
      setRecentTx(txList.slice(0, 10))

      const days: DayOmzet[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const start = new Date(d); start.setHours(0, 0, 0, 0)
        const end = new Date(d); end.setHours(23, 59, 59, 999)
        const dayTx = txList.filter(
          (t) => t.status === 'COMPLETED' && new Date(t.createdAt) >= start && new Date(t.createdAt) <= end
        )
        days.push({
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
          omzet: dayTx.reduce((s, t) => s + t.total, 0),
        })
      }
      setWeekOmzet(days)
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const id = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10)
      if (today !== todayKey) {
        setTodayKey(today)
        loadData()
      } else {
        loadData()
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [todayKey, loadData])

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        {/* Quick Action Shortcuts */}
        <div className="flex gap-2 no-print">
          <Link href="/kasir">
            <Button size="sm" className="btn-primary shadow-sm">
              <Plus className="w-4 h-4 mr-1" /> Transaksi Baru
            </Button>
          </Link>
          <Link href="/reports">
            <Button size="sm" variant="outline" className="border-border">
              <BarChart3 className="w-4 h-4 mr-1" /> Laporan
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Omzet Hari Ini</span>
            <div className="bg-emerald-50 p-2 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-emerald-600">
            {loading ? '—' : formatRupiah(omzetToday)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{txCount} transaksi hari ini</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Transaksi</span>
            <div className="bg-blue-50 p-2 rounded-lg">
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-foreground">
            {loading ? '—' : txCount}
          </p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-muted-foreground">Motor <span className="font-semibold text-foreground">{txMotor}</span></span>
            <span className="text-xs text-muted-foreground">Mobil <span className="font-semibold text-foreground">{txMobil}</span></span>
            <span className="text-xs text-muted-foreground">Lain <span className="font-semibold text-foreground">{txOther}</span></span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Kendaraan Dilayani</span>
            <div className="bg-purple-50 p-2 rounded-lg">
              <Receipt className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-foreground">
            {loading ? '—' : txCount}
          </p>
          <p className="text-sm text-muted-foreground mt-1">unit hari ini</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-5 pt-5 pb-4">
            <h3 className="text-sm font-semibold text-foreground">Omzet 7 Hari Terakhir</h3>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekOmzet} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}rb`} />
                <Tooltip
                  formatter={(value) => [formatRupiah(value as number), 'Omzet']}
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1a1d2e', fontSize: 12 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="omzet" radius={[4, 4, 0, 0]}>
                  {weekOmzet.map((_, i) => (
                    <Cell key={i} fill={i === 6 ? '#2563eb' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="px-5 pt-5 pb-4">
            <h3 className="text-sm font-semibold text-foreground">Kendaraan Hari Ini</h3>
          </div>
          <div className="px-5 pb-5">
            {vehicleBreakdown.length > 0 ? (
              <PC width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={vehicleBreakdown} cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65}
                    paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {vehicleBreakdown.map((_, i) => (
                      <PieCell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                </PieChart>
              </PC>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
                Belum ada transaksi hari ini
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Transaksi Terbaru</h3>
          <div className="flex items-center gap-3">
            <Link href="/transactions">
              <Button size="sm" variant="ghost" className="text-primary">Lihat Semua</Button>
            </Link>
            {loading ? null : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Auto-refresh 30s
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Plat No</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Layanan</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Metode</th>
                <th className="text-center px-4 py-3 font-medium">Jam</th>
                <th className="text-center px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    {loading ? 'Memuat...' : 'Belum ada transaksi'}
                  </td>
                </tr>
              ) : recentTx.map((tx) => (
                <tr key={tx.id}
                  className={`border-b border-border/50 hover:bg-accent/50 transition-colors ${tx.status === 'VOIDED' ? 'bg-red-50/30' : ''}`}>
                  <td className={`px-5 py-3 font-semibold ${tx.status === 'VOIDED' ? 'text-red-500 line-through' : 'text-primary'}`}>
                    {tx.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-foreground hidden sm:table-cell">{tx.platNomor || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[120px] truncate">
                    {tx.items.map((i) => i.serviceName).join(', ') || '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-emerald-600'}`}>
                    {formatRupiah(tx.total)}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      tx.paymentMethod === 'CASH' ? 'badge-green' :
                      tx.paymentMethod === 'TRANSFER' ? 'badge-blue' :
                      'badge-yellow'
                    }`}>
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{formatJam(tx.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="text-primary hover:text-primary/80 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTx(null)}>
          <div className="card w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Detail Transaksi</h3>
              <button onClick={() => setSelectedTx(null)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-accent rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${selectedTx.status === 'VOIDED' ? 'text-red-500' : 'text-primary'}`}>
                  {selectedTx.invoiceNumber}
                </p>
                {selectedTx.status === 'VOIDED' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">VOIDED</span>
                )}
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Plat No</span><span className="font-medium">{selectedTx.platNomor || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kendaraan</span><span className="font-medium">{selectedTx.vehicleType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Waktu</span><span className="font-medium">{new Date(selectedTx.createdAt).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Metode</span><span className="font-medium">{selectedTx.paymentMethod}</span></div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Layanan</p>
                <div className="space-y-2">
                  {selectedTx.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {item.serviceName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <span className="text-muted-foreground">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4 flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-emerald-600">{formatRupiah(selectedTx.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}