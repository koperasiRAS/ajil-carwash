'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Pencil, Loader2, AlertTriangle,
  CheckCircle, X, KeyRound, Mail, Eye,
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
interface Employee {
  id: string
  name: string
  email: string
  pin: string | null
  isActive: boolean
  createdAt: string
  _count?: { transactions: number }
}

interface EmployeeDetail {
  id: string
  name: string
  email: string
  pin: string | null
  isActive: boolean
  createdAt: string
  recentShifts: {
    id: string; openedAt: string; closedAt: string | null; status: string
    transactions: { id: string; total: number }[]
  }[]
  monthlyTxCount: number
  monthlyOmzet: number
  voidCount: number
}

// ── Component ────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterActive, setFilterActive] = useState<string>('true')

  // Form modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    name: '', email: '', password: '', pin: '', isActive: true,
  })

  // Detail modal
  const [detailEmp, setDetailEmp] = useState<EmployeeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Reset password confirm
  const [resetTarget, setResetTarget] = useState<Employee | null>(null)
  const [resetting, setResetting] = useState(false)

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterActive) params.set('isActive', filterActive)
      const res = await fetch(`/api/employees?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEmployees(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [filterActive])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditingEmp(null)
    setForm({ name: '', email: '', password: '', pin: '', isActive: true })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(e: Employee) {
    setEditingEmp(e)
    setForm({ name: e.name, email: e.email, password: '', pin: e.pin ?? '', isActive: e.isActive })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    setFormError('')
    if (!form.name.trim()) { setFormError('Nama wajib diisi'); return }
    if (!editingEmp) {
      if (!form.email.trim() || !form.email.includes('@')) { setFormError('Email valid wajib diisi'); return }
      if (!form.password || form.password.length < 8) { setFormError('Password minimal 8 karakter'); return }
    }
    if (!editingEmp && !form.pin.match(/^\d{4,6}$/)) { setFormError('PIN harus 4-6 digit angka'); return }
    if (editingEmp && form.pin && !form.pin.match(/^\d{4,6}$/)) { setFormError('PIN harus 4-6 digit angka'); return }

    setSaving(true)
    try {
      if (editingEmp) {
        const body: Record<string, unknown> = { id: editingEmp.id, name: form.name.trim(), isActive: form.isActive }
        if (form.pin) body.pin = form.pin
        const res = await fetch('/api/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            pin: form.pin,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(e: Employee, val: boolean) {
    await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, isActive: val }),
    })
    loadData()
  }

  async function handleResetPassword() {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch(`/api/employees/${resetTarget.id}/reset-password`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResetTarget(null)
      alert(`Email reset password dikirim ke ${resetTarget.email}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengirim email reset')
    } finally {
      setResetting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/employees?id=${deleteTarget.id}`, { method: 'DELETE' })
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

  async function loadDetail(e: Employee) {
    setDetailLoading(true)
    setDetailEmp(null)
    try {
      // Load shifts + transactions for this kasir
      const [shiftsRes, txRes] = await Promise.all([
        fetch(`/api/shifts?kasirId=${e.id}&limit=10`),
        fetch(`/api/transactions?kasirId=${e.id}&month=${new Date().toISOString().slice(0, 7)}`),
      ])
      const shifts = shiftsRes.ok ? await shiftsRes.json() : []
      const txData = txRes.ok ? await txRes.json() : { transactions: [] }

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyTxs = (txData.transactions ?? []).filter(
        (t: { created_at: string }) => new Date(t.created_at) >= monthStart
      )

      setDetailEmp({
        ...e,
        recentShifts: Array.isArray(shifts) ? shifts.slice(0, 10) : [],
        monthlyTxCount: monthlyTxs.length,
        monthlyOmzet: monthlyTxs.reduce((s: number, t: { total: number }) => s + t.total, 0),
        voidCount: 0,
      })
    } catch {
      setDetailEmp({ ...e, recentShifts: [], monthlyTxCount: 0, monthlyOmzet: 0, voidCount: 0 })
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> Manajemen Karyawan
        </h1>
        <Button onClick={openCreate} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> Tambah Karyawan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
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
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-center px-4 py-3 font-medium">PIN</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-600 py-10">Belum ada karyawan</td></tr>
                ) : employees.map((e) => (
                  <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <button onClick={() => loadDetail(e)}
                        className="text-white font-medium hover:text-blue-400 transition-colors text-left">
                        {e.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{e.email}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-500">
                      {e.pin ? '••••' : <span className="text-gray-700 text-xs">belum ada</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {e.isActive
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <X className="w-4 h-4 text-gray-600" />}
                        <Switch checked={e.isActive} onCheckedChange={(val) => handleToggle(e, val)} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => loadDetail(e)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 transition-colors" title="Detail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(e)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setResetTarget(e)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-yellow-900/30 transition-colors" title="Reset Password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(e)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-colors" title="Nonaktifkan">
                          <X className="w-4 h-4" />
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
            <DialogTitle className="text-white">
              {editingEmp ? 'Edit Karyawan' : 'Tambah Karyawan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nama *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama lengkap" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@contoh.com"
                disabled={!!editingEmp}
                className="bg-gray-800 border-gray-700 text-white disabled:opacity-50" />
            </div>
            {!editingEmp && (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Password Awal * (min 8 karakter)</label>
                  <Input type="password" value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Minimal 8 karakter"
                    className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">PIN * (4-6 digit)</label>
                  <Input value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="4-6 digit" maxLength={6} className="bg-gray-800 border-gray-700 text-white font-mono" />
                </div>
              </>
            )}
            {editingEmp && (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">PIN Baru (kosongkan jika tidak diubah)</label>
                  <Input value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="4-6 digit" maxLength={6} className="bg-gray-800 border-gray-700 text-white font-mono" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Karyawan Aktif</p>
                  <Switch checked={form.isActive} onCheckedChange={(val) => setForm((f) => ({ ...f, isActive: val }))} />
                </div>
              </>
            )}
            {formError && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingEmp ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Modal ── */}
      <Dialog open={!!detailEmp} onOpenChange={() => setDetailEmp(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> {detailEmp?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">{detailEmp?.email}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
          ) : detailEmp ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Transaksi Bulan Ini</p>
                  <p className="text-lg font-bold text-white">{detailEmp.monthlyTxCount}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Omzet Bulan Ini</p>
                  <p className="text-sm font-bold text-green-400">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(detailEmp.monthlyOmzet)}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Shift Aktif</p>
                  <p className="text-lg font-bold text-white">
                    {detailEmp.recentShifts.filter((s) => s.status === 'OPEN').length}
                  </p>
                </div>
              </div>

              {/* Recent shifts */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Riwayat Shift (10 terakhir)</p>
                {detailEmp.recentShifts.length === 0 ? (
                  <p className="text-gray-600 text-sm">Belum ada shift</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detailEmp.recentShifts.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-xs">
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.status === 'OPEN' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                            {s.status}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {new Date(s.openedAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <span className="text-gray-500">
                          {s.transactions?.length ?? 0} tx
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailEmp(null)} className="border-gray-700 text-gray-300">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Confirm ── */}
      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Reset Password
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Kirim email reset password ke <strong className="text-white">{resetTarget?.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleResetPassword} disabled={resetting} className="bg-yellow-600 hover:bg-yellow-500 text-white">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
              Kirim Email Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Nonaktifkan Karyawan
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Nonaktifkan <strong className="text-white">{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-400">
            Karyawan tidak bisa login lagi. Data historis tetap tersimpan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-gray-700 text-gray-300">Batal</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}