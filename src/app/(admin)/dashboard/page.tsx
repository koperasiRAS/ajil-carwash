'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/invoice'
import {
  TrendingUp,
  Receipt,
  Users,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PieChart, Pie, Cell as PieCell, Legend, ResponsiveContainer as PC } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { VehicleType } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────
interface TodayStats {
  omzetToday: number
  omzetYesterday: number
  txCount: number
  txMotor: number
  txMobil: number
  txOther: number
  activeShifts: { kasirId: string; kasirName: string; openedAt: string; openingCash: number }[]
  lowStockItems: { name: string; current: number; min: number }[]
}

interface RecentTransaction {
  id: string
  invoiceNumber: string
  kasirName: string
  vehicleType: VehicleType
  items: { serviceName: string }[]
  total: number
  paymentMethod: string
  createdAt: string
  status: 'COMPLETED' | 'VOIDED'
}

interface ShiftSummary {
  id: string
  kasirName: string
  openedAt: string
  openingCash: number
  txCount: number
  totalOmzet: number
}

interface DayOmzet {
  date: string
  label: string
  omzet: number
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatJam(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatTgl(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function pctChange(today: number, yesterday: number) {
  if (yesterday === 0) return null
  return ((today - yesterday) / yesterday) * 100
}

// ── Colors ──────────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// ── Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient()

  const [stats, setStats] = useState<TodayStats>({
    omzetToday: 0,
    omzetYesterday: 0,
    txCount: 0,
    txMotor: 0,
    txMobil: 0,
    txOther: 0,
    activeShifts: [],
    lowStockItems: [],
  })
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([])
  const [shiftSummaries, setShiftSummaries] = useState<ShiftSummary[]>([])
  const [weekOmzet, setWeekOmzet] = useState<DayOmzet[]>([])
  const [vehicleBreakdown, setVehicleBreakdown] = useState<{ name: string; value: number }[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([])
  const [selectedTx, setSelectedTx] = useState<RecentTransaction | null>(null)

  const loadData = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString()

    // Get 7 days for chart
    const days: DayOmzet[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const start = new Date(d); start.setHours(0, 0, 0, 0)
      const end = new Date(d); end.setHours(23, 59, 59, 999)
      const { data } = await supabase
        .from('transactions')
        .select('total')
        .eq('status', 'COMPLETED')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
      const total = (data ?? []).reduce((s, t) => s + t.total, 0)
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        omzet: total,
      })
    }
    setWeekOmzet(days)

    // Today stats
    const { data: todayTx } = await supabase
      .from('transactions')
      .select('total, vehicle_type, payment_method')
      .eq('status', 'COMPLETED')
      .gte('created_at', todayStr)

    const { data: yesterdayTx } = await supabase
      .from('transactions')
      .select('total')
      .eq('status', 'COMPLETED')
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr)

    const txList = todayTx ?? []
    const omzetToday = txList.reduce((s, t) => s + t.total, 0)
    const omzetYesterday = (yesterdayTx ?? []).reduce((s, t) => s + t.total, 0)

    setStats((prev) => ({
      ...prev,
      omzetToday,
      omzetYesterday,
      txCount: txList.length,
      txMotor: txList.filter((t) => t.vehicle_type === 'MOTOR').length,
      txMobil: txList.filter((t) => t.vehicle_type === 'MOBIL').length,
      txOther: txList.filter((t) => !['MOTOR', 'MOBIL'].includes(t.vehicle_type)).length,
    }))

    // Vehicle breakdown
    const motor = txList.filter((t) => t.vehicle_type === 'MOTOR').length
    const mobil = txList.filter((t) => t.vehicle_type === 'MOBIL').length
    const pickup = txList.filter((t) => t.vehicle_type === 'PICKUP').length
    const truk = txList.filter((t) => t.vehicle_type === 'TRUK').length
    setVehicleBreakdown([
      { name: 'Motor', value: motor },
      { name: 'Mobil', value: mobil },
      { name: 'Pickup', value: pickup },
      { name: 'Truk', value: truk },
    ].filter((d) => d.value > 0))

    // Payment breakdown
    const cash = txList.filter((t) => t.payment_method === 'CASH').reduce((s, t) => s + t.total, 0)
    const transfer = txList.filter((t) => t.payment_method === 'TRANSFER').reduce((s, t) => s + t.total, 0)
    const qris = txList.filter((t) => t.payment_method === 'QRIS').reduce((s, t) => s + t.total, 0)
    setPaymentBreakdown([
      { name: 'CASH', value: cash },
      { name: 'TRANSFER', value: transfer },
      { name: 'QRIS', value: qris },
    ].filter((d) => d.value > 0))

    // Active shifts
    const { data: openShifts } = await supabase
      .from('shifts')
      .select('id, kasir_id, users(name), opened_at, opening_cash')
      .eq('status', 'OPEN')
    const activeList = (openShifts ?? []).map((s) => ({
      id: s.id,
      kasirId: s.kasir_id,
      kasirName: (s.users as unknown as { name: string })?.name ?? 'Unknown',
      openedAt: s.opened_at,
      openingCash: s.opening_cash,
    }))
    setStats((prev) => ({ ...prev, activeShifts: activeList }))

    // Shift summaries with tx count & omzet
    const summaries: ShiftSummary[] = []
    for (const shift of activeList) {
      const { data: shiftTx } = await supabase
        .from('transactions')
        .select('total')
        .eq('shift_id', shift.id)
        .eq('status', 'COMPLETED')
      const txOfShift = shiftTx ?? []
      summaries.push({
        id: shift.id,
        kasirName: shift.kasirName,
        openedAt: shift.openedAt,
        openingCash: shift.openingCash,
        txCount: txOfShift.length,
        totalOmzet: txOfShift.reduce((s, t) => s + t.total, 0),
      })
    }
    setShiftSummaries(summaries)

    // Low stock
    const { data: stockItems } = await supabase
      .from('stock_items')
      .select('name, current_stock, min_stock')
      .eq('is_active', true)
    const lowStock = (stockItems ?? [])
      .filter((i) => i.current_stock <= i.min_stock)
      .map((i) => ({ name: i.name, current: i.current_stock, min: i.min_stock }))
    setStats((prev) => ({ ...prev, lowStockItems: lowStock }))

    // Recent transactions (last 10)
    const { data: recent } = await supabase
      .from('transactions')
      .select(`
        id, invoice_number, vehicle_type, total, payment_method, created_at, status,
        users!kasir_id(name),
        transaction_items(service_name, price, quantity, subtotal)
      `)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentTx(
      (recent ?? []).map((t) => ({
        id: t.id,
        invoiceNumber: t.invoice_number,
        kasirName: (t.users as unknown as { name: string })?.name ?? '-',
        vehicleType: t.vehicle_type,
        items: (t.transaction_items ?? []).map((i: { service_name: string; price: number; quantity: number; subtotal: number }) => ({ serviceName: i.service_name, price: i.price, quantity: i.quantity, subtotal: i.subtotal })),
        total: t.total,
        paymentMethod: t.payment_method,
        createdAt: t.created_at,
        status: t.status,
      }))
    )
  }, [])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Supabase Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const pct = pctChange(stats.omzetToday, stats.omzetYesterday)
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
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Omzet Hari Ini */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Omzet Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-green-400">{formatRupiah(stats.omzetToday)}</p>
          {pct !== null && <PctTag value={pct} />}
          <p className="text-xs text-gray-600 mt-1">vs kemarin {formatRupiah(stats.omzetYesterday)}</p>
        </div>

        {/* Jumlah Transaksi */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Transaksi</span>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white">{stats.txCount}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-xs text-gray-500">Motor <span className="font-semibold text-white">{stats.txMotor}</span></span>
            <span className="text-xs text-gray-500">Mobil <span className="font-semibold text-white">{stats.txMobil}</span></span>
            <span className="text-xs text-gray-500">Lain <span className="font-semibold text-white">{stats.txOther}</span></span>
          </div>
        </div>

        {/* Shift Aktif */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Shift Aktif</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white">{stats.activeShifts.length}</p>
          <div className="mt-1 space-y-0.5">
            {stats.activeShifts.slice(0, 2).map((s) => (
              <p key={s.kasirId} className="text-xs text-gray-400 truncate">{s.kasirName}</p>
            ))}
            {stats.activeShifts.length > 2 && (
              <p className="text-xs text-gray-600">+{stats.activeShifts.length - 2} lagi</p>
            )}
          </div>
        </div>

        {/* Alert Stok */}
        <div className={`border rounded-xl p-4 ${stats.lowStockItems.length > 0 ? 'bg-red-950/30 border-red-800' : 'bg-gray-900 border-gray-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Alert Stok</span>
            <AlertTriangle className={`w-4 h-4 ${stats.lowStockItems.length > 0 ? 'text-red-400' : 'text-gray-600'}`} />
          </div>
          <p className={`text-xl lg:text-2xl font-bold ${stats.lowStockItems.length > 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {stats.lowStockItems.length}
          </p>
          <div className="mt-1 space-y-0.5">
            {stats.lowStockItems.slice(0, 2).map((item) => (
              <p key={item.name} className="text-xs text-red-400/70 truncate">
                {item.name} ({item.current}/{item.min})
              </p>
            ))}
            {stats.lowStockItems.length === 0 && (
              <p className="text-xs text-gray-600">Stok aman</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Omzet 7 Hari */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Omzet 7 Hari Terakhir</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekOmzet} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}rb`} />
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
            <PC width="100%" height={180}>
              <PieChart>
                <Pie data={vehicleBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {vehicleBreakdown.map((_, i) => (
                    <PieCell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </PC>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-500 text-sm">
              Belum ada transaksi hari ini
            </div>
          )}
        </div>
      </div>

      {/* Second Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Metode Pembayaran */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Metode Pembayaran</h3>
          {paymentBreakdown.length > 0 ? (
            <PC width="100%" height={160}>
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  paddingAngle={3} dataKey="value"
                  label={({ name, value }) => `${name}: ${formatRupiah(value)}`}
                  labelLine={false}>
                  {paymentBreakdown.map((_, i) => (
                    <PieCell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </PC>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-gray-500 text-sm">
              Belum ada data
            </div>
          )}
        </div>

        {/* Shift Monitor */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Shift Aktif</h3>
          {shiftSummaries.length === 0 ? (
            <div className="flex items-center justify-center h-[140px] text-gray-500 text-sm">
              Tidak ada shift aktif
            </div>
          ) : (
            <div className="space-y-3">
              {shiftSummaries.map((s) => (
                <div key={s.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{s.kasirName}</p>
                    <p className="text-xs text-gray-500">Buka {formatJam(s.openedAt)} · Kas {formatRupiah(s.openingCash)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 font-bold text-sm">{s.txCount} tx</p>
                    <p className="text-green-400 text-xs">{formatRupiah(s.totalOmzet)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Transaksi Terbaru */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Transaksi Terbaru</h3>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Realtime
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Invoice</th>
                <th className="text-left px-4 py-2 font-medium">Kasir</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Kendaraan</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Layanan</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-center px-4 py-2 font-medium hidden sm:table-cell">Metode</th>
                <th className="text-center px-4 py-2 font-medium">Jam</th>
                <th className="text-center px-4 py-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-600 py-8">Belum ada transaksi</td></tr>
              ) : recentTx.map((tx) => (
                <tr key={tx.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${tx.status === 'VOIDED' ? 'bg-red-950/10' : ''}`}>
                  <td className={`px-4 py-2.5 font-semibold ${tx.status === 'VOIDED' ? 'text-red-400/60 line-through' : 'text-blue-400'}`}>
                    {tx.invoiceNumber}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300">{tx.kasirName}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell">{tx.vehicleType}</td>
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
                    <button onClick={() => setSelectedTx(tx)}
                      className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-blue-900/20 transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Transaksi */}
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
                <div className="flex justify-between"><span className="text-gray-500">Kasir</span><span>{selectedTx.kasirName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Kendaraan</span><span>{selectedTx.vehicleType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Waktu</span><span>{new Date(selectedTx.createdAt).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Metode</span><span>{selectedTx.paymentMethod}</span></div>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 mb-2">Layanan</p>
                <div className="space-y-1">
                  {selectedTx.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-300">{item.serviceName}{(item as any).quantity > 1 ? ` x${(item as any).quantity}` : ''}</span>
                      <span className="text-gray-400">{formatRupiah((item as any).subtotal ?? (item as any).price ?? 0)}</span>
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