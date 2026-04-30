'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, Pencil, Loader2,
  TrendingUp, TrendingDown, Minus, History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'

// ── Types ────────────────────────────────────────────────────────────────
interface StockItem {
  id: string
  name: string
  unit: string
  currentStock: number
  minStock: number
  pricePerUnit: number
  isActive: boolean
  _count?: { logs: number }
}

interface StockLog {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  previousStock: number
  currentStock: number
  note: string | null
  createdAt: string
  item: { name: string }
  user?: { name: string }
}

const LOG_TYPE_COLORS: Record<string, string> = {
  IN: 'text-green-400 bg-green-900/30',
  OUT: 'text-red-400 bg-red-900/30',
  ADJUSTMENT: 'text-yellow-400 bg-yellow-900/30',
}

// ── Component ────────────────────────────────────────────────────────────
export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [logs, setLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create item modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', unit: '', minStock: '5', pricePerUnit: '0' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Stock-in modal
  const [stockInModalOpen, setStockInModalOpen] = useState(false)
  const [stockInItem, setStockInItem] = useState<StockItem | null>(null)
  const [stockInForm, setStockInForm] = useState({ quantity: '', note: '' })

  // Adjustment modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null)
  const [adjustForm, setAdjustForm] = useState({ actualStock: '', note: '' })

  // Log history modal
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [logItem, setLogItem] = useState<StockItem | null>(null)
  const [logLoading, setLogLoading] = useState(false)

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<StockItem | null>(null)
  const [editForm, setEditForm] = useState({ name: '', unit: '', minStock: '5', pricePerUnit: '0' })

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stock')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setItems(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleCreate() {
    setFormError('')
    if (!createForm.name.trim()) { setFormError('Nama item wajib diisi'); return }
    if (!createForm.unit.trim()) { setFormError('Satuan wajib diisi'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _intent: 'create',
          name: createForm.name.trim(),
          unit: createForm.unit.trim(),
          minStock: parseFloat(createForm.minStock) || 5,
          pricePerUnit: parseInt(createForm.pricePerUnit.replace(/[^0-9]/g, ''), 10) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCreateModalOpen(false)
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleStockIn() {
    if (!stockInItem) return
    const qty = parseFloat(stockInForm.quantity)
    if (!qty || qty <= 0) { setFormError('Jumlah harus lebih dari 0'); return }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _intent: 'stockIn',
          itemId: stockInItem.id,
          quantity: qty,
          note: stockInForm.note.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setStockInModalOpen(false)
      setStockInItem(null)
      setStockInForm({ quantity: '', note: '' })
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdjust() {
    if (!adjustItem) return
    const actual = parseFloat(adjustForm.actualStock)
    if (isNaN(actual) || actual < 0) { setFormError('Stok tidak valid'); return }
    if (!adjustForm.note.trim() || adjustForm.note.trim().length < 10) {
      setFormError('Catatan wajib minimal 10 karakter'); return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _intent: 'adjust',
          itemId: adjustItem.id,
          actualStock: actual,
          note: adjustForm.note.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAdjustModalOpen(false)
      setAdjustItem(null)
      setAdjustForm({ actualStock: '', note: '' })
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editItem) return
    if (!editForm.name.trim()) { setFormError('Nama item wajib diisi'); return }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem.id,
          name: editForm.name.trim(),
          unit: editForm.unit.trim(),
          minStock: parseFloat(editForm.minStock) || 5,
          pricePerUnit: parseInt(editForm.pricePerUnit.replace(/[^0-9]/g, ''), 10) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEditModalOpen(false)
      setEditItem(null)
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function loadLogHistory(item: StockItem) {
    setLogItem(item)
    setLogLoading(true)
    setLogModalOpen(true)
    try {
      const res = await fetch(`/api/stock-logs?itemId=${item.id}`)
      const json = await res.json()
      setLogs(res.ok ? json : [])
    } catch {
      setLogs([])
    } finally {
      setLogLoading(false)
    }
  }

  function openStockIn(item: StockItem) {
    setStockInItem(item)
    setStockInForm({ quantity: '', note: '' })
    setFormError('')
    setStockInModalOpen(true)
  }

  function openAdjust(item: StockItem) {
    setAdjustItem(item)
    setAdjustForm({ actualStock: item.currentStock.toString(), note: '' })
    setFormError('')
    setAdjustModalOpen(true)
  }

  function openEdit(item: StockItem) {
    setEditItem(item)
    setEditForm({ name: item.name, unit: item.unit, minStock: item.minStock.toString(), pricePerUnit: item.pricePerUnit.toString() })
    setFormError('')
    setEditModalOpen(true)
  }

  function getStockStatus(item: StockItem) {
    if (item.currentStock <= 0) return { label: 'KOSONG', color: 'text-red-400 bg-red-900/30' }
    if (item.currentStock <= item.minStock) return { label: 'MENIPIS', color: 'text-yellow-400 bg-yellow-900/30' }
    return { label: 'TERSEDIA', color: 'text-green-400 bg-green-900/30' }
  }

  const diff = (adjustItem: StockItem | null, actual: string) => {
    if (!adjustItem) return null
    const a = parseFloat(actual)
    if (isNaN(a) || a < 0) return null
    const d = a - adjustItem.currentStock
    if (d === 0) return null
    return d
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" /> Manajemen Stok
        </h1>
        <div className="flex gap-2">
          <Button onClick={() => { setCreateForm({ name: '', unit: '', minStock: '5', pricePerUnit: '0' }); setFormError(''); setCreateModalOpen(true) }}
            size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            <Plus className="w-4 h-4 mr-1" /> Tambah Item
          </Button>
        </div>
      </div>

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
                  <th className="text-left px-4 py-3 font-medium">Nama Item</th>
                  <th className="text-center px-4 py-3 font-medium">Satuan</th>
                  <th className="text-right px-4 py-3 font-medium">Stok Saat Ini</th>
                  <th className="text-center px-4 py-3 font-medium">Min. Stok</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-600 py-10">Belum ada item stok</td></tr>
                ) : items.map((item) => {
                  const status = getStockStatus(item)
                  const isCritical = item.currentStock <= item.minStock
                  return (
                    <tr key={item.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${isCritical ? 'bg-red-950/10' : ''}`}>
                      <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${isCritical ? 'text-red-400' : 'text-green-400'}`}>
                          {item.currentStock.toLocaleString('id-ID')}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{item.minStock} {item.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => loadLogHistory(item)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 transition-colors" title="Riwayat">
                            <History className="w-4 h-4" />
                          </button>
                          <button onClick={() => openStockIn(item)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-green-400 hover:bg-green-900/30 transition-colors" title="Stock In">
                            <TrendingUp className="w-4 h-4" />
                          </button>
                          <button onClick={() => openAdjust(item)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-yellow-900/30 transition-colors" title="Adjustment">
                            <Minus className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(item)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Item Modal ── */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Tambah Item Stok</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nama Item *</label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sabun cuciaMobil" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Satuan *</label>
              <Input value={createForm.unit} onChange={(e) => setCreateForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="liter, pcs, kg" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stok Minimum</label>
                <Input type="number" value={createForm.minStock} onChange={(e) => setCreateForm((f) => ({ ...f, minStock: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Harga per Unit (Rp)</label>
                <Input value={createForm.pricePerUnit} onChange={(e) => setCreateForm((f) => ({ ...f, pricePerUnit: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock In Modal ── */}
      <Dialog open={stockInModalOpen} onOpenChange={setStockInModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Tambah Stok — {stockInItem?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Stok saat ini: <strong className="text-white">{stockInItem?.currentStock} {stockInItem?.unit}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Jumlah Ditambah *</label>
              <Input type="number" value={stockInForm.quantity} onChange={(e) => setStockInForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder={`Jumlah dalam ${stockInItem?.unit ?? 'unit'}`}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Catatan (optional)</label>
              <Input value={stockInForm.note} onChange={(e) => setStockInForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Pembelian dari supplier X" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleStockIn} disabled={saving} className="bg-green-600 hover:bg-green-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjustment Modal ── */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2">
              <Minus className="w-5 h-5" /> Adjustment Stok — {adjustItem?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Stok tercatat: <strong className="text-white">{adjustItem?.currentStock} {adjustItem?.unit}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Stok Aktual (hasil hitung fisik) *</label>
              <Input type="number" value={adjustForm.actualStock}
                onChange={(e) => setAdjustForm((f) => ({ ...f, actualStock: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            {adjustItem && (() => {
              const d = diff(adjustItem, adjustForm.actualStock)
              return d !== null ? (
                <div className={`text-sm px-3 py-2 rounded-lg ${d > 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                  Selisih: {d > 0 ? '+' : ''}{d} {adjustItem.unit}
                </div>
              ) : null
            })()}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Catatan / Alasan Adjustment * (min 10 karakter)</label>
              <Input value={adjustForm.note} onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Hitung stok fisik gudang 21 April 2026" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleAdjust} disabled={saving} className="bg-yellow-600 hover:bg-yellow-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Log History Modal ── */}
      <Dialog open={logModalOpen} onOpenChange={() => { setLogModalOpen(false); setLogItem(null); setLogs([]) }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" /> Riwayat Stok — {logItem?.name}
            </DialogTitle>
          </DialogHeader>
          {logLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
          ) : logs.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Belum ada riwayat stok</p>
          ) : (
            <div className="overflow-y-auto max-h-80 space-y-1">
              {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${LOG_TYPE_COLORS[log.type]}`}>
                      {log.type}
                    </span>
                    <span className="text-gray-400 flex-1">
                      {new Date(log.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={log.quantity >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {log.quantity >= 0 ? '+' : ''}{log.quantity}
                    </span>
                    <span className="text-gray-500">
                      {log.previousStock} → {log.currentStock}
                    </span>
                    <span className="text-gray-600 truncate max-w-[150px]">{log.note ?? '—'}</span>
                  </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLogModalOpen(false); setLogItem(null) }} className="border-gray-700 text-gray-300">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Item — {editItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nama Item *</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Satuan *</label>
              <Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stok Minimum</label>
                <Input type="number" value={editForm.minStock} onChange={(e) => setEditForm((f) => ({ ...f, minStock: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Harga per Unit (Rp)</label>
                <Input value={editForm.pricePerUnit} onChange={(e) => setEditForm((f) => ({ ...f, pricePerUnit: e.target.value.replace(/\D/g, '') }))}
                  className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}