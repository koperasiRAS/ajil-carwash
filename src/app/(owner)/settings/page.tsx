'use client'

import { useState, useEffect } from 'react'
import { Settings, Loader2, Save, Download, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// ── Types ────────────────────────────────────────────────────────────────
interface SystemSettings {
  businessName: string
  businessAddress: string
  businessPhone: string
  maxDiscountPercent: number
  sessionTimeoutMinutes: number
  requireVehiclePlate: boolean
  requireCustomerName: boolean
  waOwnerNumber: string
  notifyOnVoid: boolean
  notifyOnShiftDiff: boolean
  notifyOnLowStock: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDateLocalStorage(key: string): string {
  if (typeof window === 'undefined') return '—'
  return localStorage.getItem(key) ?? '—'
}

async function exportAllData() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  async function addSheet(table: string, fields: string[]) {
    const res = await fetch(`/api/export/${table}`)
    if (!res.ok) return
    const json = await res.json()
    const data = json.data ?? []
    if (!data.length) return
    const rows: (string | number)[][] = [fields]
    data.forEach((row: Record<string, unknown>) => {
      rows.push(fields.map((f) => String(row[f] ?? '')))
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, table.length > 25 ? table.slice(0, 25) : table)
  }

  const tables = ['users', 'services', 'transactions', 'expenses', 'stock_items']
  await Promise.all(tables.map((t) => addSheet(t, ['id', 'name', 'created_at'])))

  XLSX.writeFile(wb, `carwash-backup-${new Date().toISOString().slice(0, 10)}.xlsx`)

  const key = 'carwash_backup_lastrun'
  const now = new Date().toLocaleString('id-ID')
  localStorage.setItem(key, now)
  return now
}

// ── Component ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    businessName: 'Ajil Car Wash',
    businessAddress: '',
    businessPhone: '',
    maxDiscountPercent: 0,
    sessionTimeoutMinutes: 30,
    requireVehiclePlate: false,
    requireCustomerName: false,
    waOwnerNumber: '',
    notifyOnVoid: true,
    notifyOnShiftDiff: true,
    notifyOnLowStock: true,
  })
  const [original, setOriginal] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [lastBackup, setLastBackup] = useState('—')
  const [activeTab, setActiveTab] = useState('PROFIL')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setSettings(json.settings)
        setOriginal(json.settings)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
    setLastBackup(formatDateLocalStorage('carwash_backup_lastrun'))
  }, [])

  function hasChanges() {
    if (!original) return false
    return JSON.stringify(settings) !== JSON.stringify(original)
  }

  async function handleSave() {
    if (!hasChanges()) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOriginal(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportAllData()
      setLastBackup(new Date().toLocaleString('id-ID'))
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    )
  }

  const changedFields = original
    ? Object.keys(settings).filter((k) => JSON.stringify((settings as unknown as Record<string, unknown>)[k]) !== JSON.stringify((original as unknown as Record<string, unknown>)[k]))
    : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" /> Pengaturan Sistem
        </h1>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Tersimpan
            </span>
          )}
          {hasChanges() && (
            <span className="text-yellow-400 text-xs bg-yellow-900/30 px-2 py-1 rounded-full border border-yellow-800">
              Ada perubahan belum disimpan
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || !hasChanges()}
            className="bg-blue-600 hover:bg-blue-500 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Simpan Perubahan
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div>
        <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit mb-4">
          {(['PROFIL', 'KASIR', 'NOTIFIKASI', 'BACKUP'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {tab === 'PROFIL' ? 'Profil Usaha' :
               tab === 'KASIR' ? 'Pengaturan Kasir' :
               tab === 'NOTIFIKASI' ? 'Notifikasi' : 'Backup Data'}
            </button>
          ))}
        </div>

        {/* ── Tab: Profil Usaha ── */}
        {activeTab === 'PROFIL' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4 max-w-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Informasi yang tampil di struk dan header</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nama Usaha</label>
                <Input value={settings.businessName}
                  onChange={(e) => setSettings((s) => ({ ...s, businessName: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Alamat</label>
                <Input value={settings.businessAddress}
                  onChange={(e) => setSettings((s) => ({ ...s, businessAddress: e.target.value }))}
                  placeholder="Jl. example No. 1, Kota" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nomor Telepon</label>
                <Input value={settings.businessPhone}
                  onChange={(e) => setSettings((s) => ({ ...s, businessPhone: e.target.value }))}
                  placeholder="08xxxxxxxxxx" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Pengaturan Kasir ── */}
        {activeTab === 'KASIR' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5 max-w-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pengaturan perilaku kasir saat bertransaksi</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Maksimal Diskon (%)</label>
                <p className="text-xs text-gray-600 mb-2">0% = kasir tidak bisa kasih diskon sama sekali</p>
                <Input type="number" min={0} max={100}
                  value={settings.maxDiscountPercent}
                  onChange={(e) => setSettings((s) => ({ ...s, maxDiscountPercent: parseInt(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700 text-white w-32" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Session Timeout (menit)</label>
                <p className="text-xs text-gray-600 mb-2">Kasir auto logout setelah tidak aktif</p>
                <div className="flex gap-2">
                  {[15, 30, 60].map((min) => (
                    <button key={min} onClick={() => setSettings((s) => ({ ...s, sessionTimeoutMinutes: min }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        settings.sessionTimeoutMinutes === min
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                      }`}>
                      {min} menit
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-800">
                <div>
                  <p className="text-sm text-white">Wajib Input Plat Nomor</p>
                  <p className="text-xs text-gray-500">Kasir harus input plat nomor kendaraan</p>
                </div>
                <Switch checked={settings.requireVehiclePlate}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, requireVehiclePlate: v }))} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-800">
                <div>
                  <p className="text-sm text-white">Wajib Input Nama Pelanggan</p>
                  <p className="text-xs text-gray-500">Kasir harus input nama pelanggan</p>
                </div>
                <Switch checked={settings.requireCustomerName}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, requireCustomerName: v }))} />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Notifikasi ── */}
        {activeTab === 'NOTIFIKASI' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5 max-w-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pengaturan notifikasi via WhatsApp ke owner</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nomor WA Owner</label>
              <p className="text-xs text-gray-600 mb-2">Format: kode negara + nomor (contoh: 628123456789)</p>
              <Input value={settings.waOwnerNumber}
                onChange={(e) => setSettings((s) => ({ ...s, waOwnerNumber: e.target.value }))}
                placeholder="628xxxxxxxxxx" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-4">
              {[
                { key: 'notifyOnVoid', label: 'Notif Void Transaksi', desc: 'Kirim notifikasi saat transaksi di-void' },
                { key: 'notifyOnShiftDiff', label: 'Notif Selisih Kas', desc: 'Kirim notifikasi saat ada selisih kas di shift' },
                { key: 'notifyOnLowStock', label: 'Notif Stok Menipis', desc: 'Kirim notifikasi saat stok di bawah minimum' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-t border-gray-800 first:border-t-0">
                  <div>
                    <p className="text-sm text-white">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <Switch
                    checked={(settings as unknown as Record<string, boolean>)[key]}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, [key]: v }))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Backup Data ── */}
        {activeTab === 'BACKUP' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4 max-w-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Export semua data ke file Excel</p>
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Backup terakhir</span>
                <span className="text-white font-mono text-xs">{lastBackup}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Tabel yang di-export</span>
                <span className="text-white text-xs">users, services, transactions, expenses, stock_items</span>
              </div>
            </div>
            <Button onClick={handleExport} disabled={exporting}
              className="bg-green-600 hover:bg-green-500 text-white">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Export Semua Data
            </Button>
          </div>
        )}
      </div>

      {/* Change diff summary (always visible when changed) */}
      {hasChanges() && (
        <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-4">
          <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">Perubahan yang akan disimpan:</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {changedFields.map((field) => (
              <div key={field} className="bg-gray-900/50 rounded-lg px-3 py-2">
                <p className="text-gray-500">{field}</p>
                <p className="text-white truncate">
                  {String(((original as unknown as Record<string, unknown>)[field]) ?? '')} → {String(((settings as unknown as Record<string, unknown>)[field]) ?? '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
