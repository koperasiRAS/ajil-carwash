'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  TrendingUp,
  Receipt,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PieChart, Pie, Cell as PieCell, Legend, ResponsiveContainer as PC } from 'recharts'

type VehicleType = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'
type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS'
type TransactionStatus = 'COMPLETED' | 'VOIDED'

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
  paymentMethod: PaymentMethod
  subtotal: number
  discount: number
  total: number
  paymentAmount: number
  change: number
  status: TransactionStatus
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

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export default function DashboardPage() {
  // Track current date to auto-reset at midnight
  const [todayKey, setTodayKey] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [weekOmzet, setWeekOmzet] = useState<DayOmzet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  // ── Stats derived from today's transactions ────────────────────────────
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

  const paymentBreakdown = [
    {
      name: 'CASH',
      value: todayTx.filter((t) => t.paymentMethod === 'CASH').reduce((s, t) => s + t.total, 0),
    },
    {
      name: 'TRANSFER',
      value: todayTx.filter((t) => t.paymentMethod === 'TRANSFER').reduce((s, t) => s + t.total, 0),
    },
    {
      name: 'QRIS',
      value: todayTx.filter((t) => t.paymentMethod === 'QRIS').reduce((s, t) => s + t.total, 0),
    },
  ].filter((d) => d.value > 0)

  // ── Load data from API (Prisma) ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions?page=1&limit=100')
      if (!res.ok) return
      const data = await res.json()
      const txList: Transaction[] = data.transactions ?? []

      setTransactions(txList)
      setRecentTx(txList.slice(0, 10))

      // 7-day chart
      const days: DayOmzet[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const start = new Date(d); start.setHours(0, 0, 0, 0)
        const end = new Date(d); end.setHours(23, 59, 59, 999)
        const dayTx = txList.filter(
          (t) =>
            t.status === 'COMPLETED' &&
            new Date(t.createdAt) >= start &&
            new Date(t.createdAt) <= end
        )
        const omzet = dayTx.reduce((s, t) => s + t.total, 0)
        days.push({
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
          omzet,
        })
      }
      setWeekOmzet(days)
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh every 30 seconds + check midnight
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

  const PctTag = ({ value }: { value: number }) => (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {value >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Omzet Hari Ini */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Omzet Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-green-400">
            {loading ? '—' : formatRupiah(omzetToday)}
          </p>
          <p className="text-xs text-gray-600 mt-1">{txCount} transaksi</p>
        </div>

        {/* Jumlah Transaksi */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Transaksi</span>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-white">{loading ? '—' : txCount}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-xs text-gray-500">Motor <span className="font-semibold text-white">{txMotor}</span></span>
            <span className="text-xs text-gray-500">Mobil <span className="font-semibold text-white">{txMobil}</span></span>
            <span className="text-xs text-gray-500">Lain <span className="font-semibold text-white">{txOther}</span></span>
          </div>
        </div>

        {/* Plat Nomor Hari Ini */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Plat Dilayani</span>
            <Receipt className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-white">{loading ? '—' : txCount}</p>
          <p className="text-xs text-gray-600 mt-1">kendaraan hari ini</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Omzet 7 Hari */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Omzet 7 Hari Terakhir</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekOmzet} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}rb`} />
              <Tooltip
                formatter={(value) => [formatRupiah(value as number), 'Omzet']}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                cursor={{ fill: '#37415140' }}
              />
              <Bar dataKey="omzet" radius={[4, 4, 0, 0]}>
                {weekOmzet.map((_, i) => (
                  <Cell key={i} fill={i === 6 ? '#3b82f6' : '#374151'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown Kendaraan */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Kendaraan Hari Ini</h3>
          {vehicleBreakdown.length > 0 ? (
            <PC width="100%" height={160}>
              <PieChart>
                <Pie
                  data={vehicleBreakdown}
                  cx="50%" cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {vehicleBreakdown.map((_, i) => (
                    <PieCell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </PC>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-gray-500 text-sm">
              Belum ada transaksi hari ini
            </div>
          )}
        </div>
      </div>

      {/* Tabel Transaksi Terbaru */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Transaksi Terbaru</h3>
          {loading ? null : (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Auto-refresh 30s
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Invoice</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Plat No</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Layanan</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-center px-4 py-2 font-medium hidden sm:table-cell">Metode</th>
                <th className="text-center px-4 py-2 font-medium">Jam</th>
                <th className="text-center px-4 py-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-600 py-8">
                    {loading ? 'Memuat...' : 'Belum ada transaksi'}
                  </td>
                </tr>
              ) : recentTx.map((tx) => (
                <tr key={tx.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                    tx.status === 'VOIDED' ? 'bg-red-950/10' : ''
                  }`}>
                  <td className={`px-4 py-2.5 font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-blue-400'}`}>
                    {tx.invoiceNumber}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 hidden sm:table-cell">{tx.platNomor || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell max-w-[120px] truncate">
                    {tx.items.map((i) => i.serviceName).join(', ') || '-'}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-green-400'}`}>
                    {formatRupiah(tx.total)}
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tx.paymentMethod === 'CASH' ? 'bg-green-900/40 text-green-400' :
                      tx.paymentMethod === 'TRANSFER' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-purple-900/40 text-purple-400'
                    }`}>
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{formatJam(tx.createdAt)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-blue-900/20 transition-colors"
                    >
                      <span className="text-xs">Detail</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Detail Transaksi</h3>
              <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${selectedTx.status === 'VOIDED' ? 'text-red-400' : 'text-blue-400'}`}>
                  {selectedTx.invoiceNumber}
                </p>
                {selectedTx.status === 'VOIDED' && <p className="text-xs text-red-400 mt-1">VOIDED</p>}
              </div>
              <div className="space-y-2 text-gray-300">
                <div className="flex justify-between"><span className="text-gray-500">Plat No</span><span>{selectedTx.platNomor || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Kendaraan</span><span>{selectedTx.vehicleType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Waktu</span><span>{new Date(selectedTx.createdAt).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Metode</span><span>{selectedTx.paymentMethod}</span></div>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 mb-2">Layanan</p>
                <div className="space-y-1">
                  {selectedTx.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        {item.serviceName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <span className="text-gray-400">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-800 pt-3 flex justify-between text-white font-bold">
                <span>Total</span>
                <span className="text-green-400">{formatRupiah(selectedTx.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}