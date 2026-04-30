'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/invoice'
import {
  Tag, Plus, Pencil, Trash2, Loader2,
  AlertTriangle, CheckCircle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────
type VehicleCategory = 'MOTOR' | 'MOBIL' | 'PICKUP' | 'TRUK'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  category: VehicleCategory
  durationMinutes: number
  isActive: boolean
  createdAt: string
  _count?: { transactionItems: number }
}

const VEHICLE_OPTIONS: { value: VehicleCategory; label: string }[] = [
  { value: 'MOTOR', label: 'Motor' },
  { value: 'MOBIL', label: 'Mobil' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'TRUK', label: 'Truk' },
]

const VEHICLE_COLORS: Record<VehicleCategory, string> = {
  MOTOR: 'bg-blue-900/30 text-blue-400',
  MOBIL: 'bg-green-900/30 text-green-400',
  PICKUP: 'bg-yellow-900/30 text-yellow-400',
  TRUK: 'bg-purple-900/30 text-purple-400',
}

// ── Component ────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterCategory, setFilterCategory] = useState<VehicleCategory | 'ALL'>('ALL')
  const [filterActive, setFilterActive] = useState<string>('true')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', price: '',
    category: 'MOBIL' as VehicleCategory, durationMinutes: '30', isActive: true,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory !== 'ALL') params.set('category', filterCategory)
      if (filterActive) params.set('isActive', filterActive)
      const res = await fetch(`/api/services?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setServices(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterActive])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditingService(null)
    setForm({ name: '', description: '', price: '', category: 'MOBIL', durationMinutes: '30', isActive: true })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(s: Service) {
    setEditingService(s)
    setForm({
      name: s.name,
      description: s.description ?? '',
      price: s.price.toLocaleString('id-ID'),
      category: s.category,
      durationMinutes: s.durationMinutes.toString(),
      isActive: s.isActive,
    })
    setFormError('')
    setModalOpen(true)
  }

  function formatPriceDisplay(val: string) {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0
    return num > 0 ? num.toLocaleString('id-ID') : ''
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Nama layanan wajib diisi'); return }
    const price = parseInt(form.price.replace(/[^0-9]/g, ''), 10) || 0
    if (price < 0) { setFormError('Harga tidak valid'); return }
    const duration = parseInt(form.durationMinutes, 10) || 30

    setSaving(true)
    setFormError('')

    try {
      if (editingService) {
        if (price !== editingService.price) {
          setPriceConfirm({ service: editingService, price, duration })
          setSaving(false)
          return
        }
        await doUpdate(price, duration)
      } else {
        await doCreate(price, duration)
      }
    } finally {
      setSaving(false)
    }
  }

  async function doUpdate(price: number, duration: number) {
    const res = await fetch('/api/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingService!.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        category: form.category,
        durationMinutes: duration,
        isActive: form.isActive,
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setModalOpen(false)
    loadData()
  }

  async function doCreate(price: number, duration: number) {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        category: form.category,
        durationMinutes: duration,
        isActive: form.isActive,
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setModalOpen(false)
    loadData()
  }

  async function handleToggle(s: Service, val: boolean) {
    await fetch('/api/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, isActive: val }),
    })
    loadData()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/services?id=${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  // Price change confirm state
  const [priceConfirm, setPriceConfirm] = useState<{
    service: Service; price: number; duration: number
  } | null>(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-400" /> Layanan & Harga
        </h1>
        <Button onClick={openCreate} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> Tambah Layanan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Kategori</label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory((v ?? 'ALL') as VehicleCategory | 'ALL')}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {VEHICLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <Select value={filterActive} onValueChange={(v) => setFilterActive(v ?? '')}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Aktif</SelectItem>
              <SelectItem value="false">Nonaktif</SelectItem>
              <SelectItem value="">Semua</SelectItem>
            </SelectContent>
          </Select>
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
                  <th className="text-left px-4 py-3 font-medium">Nama Layanan</th>
                  <th className="text-left px-4 py-3 font-medium">Kategori</th>
                  <th className="text-right px-4 py-3 font-medium">Harga</th>
                  <th className="text-center px-4 py-3 font-medium">Durasi</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-600 py-10">Belum ada layanan</td></tr>
                ) : services.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{s.name}</p>
                      {s.description && <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VEHICLE_COLORS[s.category]}`}>
                        {VEHICLE_OPTIONS.find((o) => o.value === s.category)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">
                      {formatRupiah(s.price)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{s.durationMinutes} menit</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {s.isActive
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <X className="w-4 h-4 text-gray-600" />}
                        <Switch
                          checked={s.isActive}
                          onCheckedChange={(val) => handleToggle(s, val)}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Form Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editingService ? 'Edit Layanan' : 'Tambah Layanan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nama Layanan *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cuci mobil lengkap" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Kategori Kendaraan *</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as VehicleCategory }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Harga (Rp) *</label>
                <Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: formatPriceDisplay(e.target.value) }))}
                  placeholder="50.000" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Durasi (menit)</label>
                <Input type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                  placeholder="30" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Deskripsi (optional)</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Pencucian luar & dalam" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Layanan Aktif</p>
              <Switch checked={form.isActive} onCheckedChange={(val) => setForm((f) => ({ ...f, isActive: val }))} />
            </div>
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingService ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price Change Confirm ── */}
      <Dialog open={!!priceConfirm} onOpenChange={() => setPriceConfirm(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Konfirmasi Ubah Harga
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Harga <strong className="text-white">{priceConfirm?.service.name}</strong> akan diubah:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Harga Lama:</span>
              <span className="text-red-400 line-through">{priceConfirm ? formatRupiah(priceConfirm.service.price) : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Harga Baru:</span>
              <span className="text-green-400 font-bold">{priceConfirm ? formatRupiah(priceConfirm.price) : ''}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600">Transaksi lama tidak berubah. Perubahan hanya berlaku untuk transaksi baru.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceConfirm(null)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={() => { if (priceConfirm) { setModalOpen(false); doUpdate(priceConfirm.price, priceConfirm.duration) }; setPriceConfirm(null) }}
              className="bg-yellow-600 hover:bg-yellow-500 text-white">
              Ya, Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Hapus Layanan
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Hapus layanan <strong className="text-white">{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?._count?.transactionItems ? (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">
              Tidak bisa menghapus — sudah dipakai di {deleteTarget._count.transactionItems} transaksi.
              Nonaktifkan saja layanan ini.
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Layanan akan dinonaktifkan (soft delete). Data historis tetap tersimpan.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleDelete} disabled={deleting || !!(deleteTarget?._count?.transactionItems)}
              className="bg-red-600 hover:bg-red-500 text-white">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
