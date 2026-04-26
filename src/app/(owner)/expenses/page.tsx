'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  Wallet, Plus, Loader2, FileSpreadsheet,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────
type ExpenseCategory = 'OPERASIONAL' | 'GAJI' | 'SABUN_CHEMICAL' | 'LISTRIK_AIR' | 'PERALATAN' | 'LAINNYA'

interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  createdAt: string
  kasir: { id: string; name: string }
  shift: { id: string; openedAt: string }
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  OPERASIONAL: 'Operasional',
  GAJI: 'Gaji',
  SABUN_CHEMICAL: 'Sabun & Chemical',
  LISTRIK_AIR: 'Listrik & Air',
  PERALATAN: 'Peralatan',
  LAINNYA: 'Lainnya',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  OPERASIONAL: 'text-blue-400 bg-blue-900/30',
  GAJI: 'text-purple-400 bg-purple-900/30',
  SABUN_CHEMICAL: 'text-green-400 bg-green-900/30',
  LISTRIK_AIR: 'text-yellow-400 bg-yellow-900/30',
  PERALATAN: 'text-orange-400 bg-orange-900/30',
  LAINNYA: 'text-gray-400 bg-gray-800',
}

// ── Component ────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10))
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'ALL'>('ALL')

  // Create modal
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    category: 'OPERASIONAL' as ExpenseCategory,
    description: '',
    amount: '',
    note: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterCategory !== 'ALL') params.set('category', filterCategory)
      const res = await fetch(`/api/expenses?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setExpenses(json.expenses ?? [])
      setTotalAmount(json.totalAmount ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterCategory])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreate() {
    setFormError('')
    if (!form.description.trim()) { setFormError('Deskripsi wajib diisi'); return }
    const amount = parseInt(form.amount.replace(/[^0-9]/g, ''), 10)
    if (!amount || amount <= 0) { setFormError('Jumlah harus lebih dari 0'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          description: form.description.trim(),
          amount,
          note: form.note.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModalOpen(false)
      setForm({ category: 'OPERASIONAL', description: '', amount: '', note: '' })
      loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const rows: (string | number)[][] = [
      ['Tanggal', 'Kategori', 'Deskripsi', 'Jumlah', 'Input Oleh', 'Shift'],
    ]
    expenses.forEach((e) => {
      rows.push([
        new Date(e.createdAt).toLocaleDateString('id-ID'),
        CATEGORY_LABELS[e.category],
        e.description,
        e.amount,
        e.kasir?.name ?? '-',
        new Date(e.shift?.openedAt ?? '').toLocaleDateString('id-ID'),
      ])
    })
    rows.push([])
    rows.push(['Total Pengeluaran', '', '', totalAmount])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran')
    XLSX.writeFile(wb, `pengeluaran-${filterFrom}-${filterTo}.xlsx`)
  }

  function formatAmountInput(val: string) {
    const num = val.replace(/[^0-9]/g, '')
    if (!num) return ''
    return parseInt(num, 10).toLocaleString('id-ID')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-400" /> Manajemen Pengeluaran
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Export Excel
          </Button>
          <Button onClick={() => { setFormError(''); setModalOpen(true) }}
            size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            <Plus className="w-4 h-4 mr-1" /> Tambah Pengeluaran
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dari Tanggal</label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sampai Tanggal</label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Kategori</label>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory((v ?? 'ALL') as ExpenseCategory | 'ALL')}>
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadData} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            <Filter className="w-4 h-4 mr-1" /> Tampilkan
          </Button>
        </div>
      </div>

      {/* Total */}
      {!loading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">Total Pengeluaran Periode</p>
          <p className="text-xl font-bold text-red-400">{formatRupiah(totalAmount)}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">{error}</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 font-medium">Deskripsi</th>
                  <th className="text-right px-4 py-3 font-medium">Jumlah</th>
                  <th className="text-left px-4 py-3 font-medium">Input Oleh</th>
                  <th className="text-left px-4 py-3 font-medium">Shift</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-600 py-10">Belum ada pengeluaran</td></tr>
                ) : expenses.map((e) => (
                  <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(e.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[e.category]}`}>
                        {CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{e.description}</td>
                    <td className="px-4 py-3 text-right text-red-400 font-semibold">
                      {formatRupiah(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{e.kasir?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {e.shift?.openedAt ? new Date(e.shift.openedAt).toLocaleDateString('id-ID') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Tambah Pengeluaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Kategori *</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: (v ?? 'OPERASIONAL') as ExpenseCategory }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                    <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Deskripsi *</label>
              <Input value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Pembelian sabun kendaraan" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Jumlah (Rp) *</label>
              <Input value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: formatAmountInput(e.target.value) }))}
                placeholder="50.000" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Catatan (optional)</label>
              <Input value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Dari supplier XYZ" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}