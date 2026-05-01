'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Save, Download, CheckCircle, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SystemSettings {
  businessName: string
  businessAddress: string
  businessPhone: string
}

const STORAGE_KEY = 'carwash_settings'

function loadSettings(): SystemSettings {
  if (typeof window === 'undefined') return { businessName: 'Ajil Car Wash', businessAddress: '', businessPhone: '' }
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : { businessName: 'Ajil Car Wash', businessAddress: '', businessPhone: '' }
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings>({ businessName: 'Ajil Car Wash', businessAddress: '', businessPhone: '' })
  const [original, setOriginal] = useState<SystemSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Clear data flow
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearConfirm2, setClearConfirm2] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    setOriginal(s)
  }, [])

  function hasChanges() {
    if (!original) return false
    return JSON.stringify(settings) !== JSON.stringify(original)
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setOriginal(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/transactions?limit=1000')
      const json = await res.json()
      const txList = json.transactions ?? []

      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const sheet = txList.map((t: Record<string, unknown>) => ({
        Invoice: t.invoiceNumber,
        Tanggal: new Date(t.createdAt as string).toLocaleString('id-ID'),
        Plat: t.platNomor ?? '-',
        Kendaraan: t.vehicleType,
        'Metode Bayar': t.paymentMethod,
        Subtotal: t.subtotal,
        Diskon: t.discount,
        Total: t.total,
        Bayar: t.paymentAmount,
        Kembalian: t.change,
        Status: t.status,
      }))

      const ws = XLSX.utils.json_to_sheet(sheet)
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
      XLSX.writeFile(wb, `carwash-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      console.error('Export error:', e)
    } finally {
      setExporting(false)
    }
  }

  async function handleClearAllData() {
    setClearing(true)
    setClearError('')
    try {
      const res = await fetch('/api/transactions/clear-all', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus data')
      // Redirect to dashboard to confirm fresh state
      router.replace('/dashboard')
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Gagal menghapus data')
      setClearing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" /> Pengaturan Sistem
        </h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-emerald-600 text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Tersimpan
            </span>
          )}
          {hasChanges() && (
            <span className="text-warning text-xs bg-warning/10 px-2 py-1 rounded-full border border-warning/20">
              Ada perubahan belum disimpan
            </span>
          )}
          <Button onClick={handleSave} disabled={!hasChanges()} className="btn-primary">
            <Save className="w-4 h-4 mr-1" /> Simpan
          </Button>
        </div>
      </div>

      {/* Business Info Card */}
      <div className="card px-5 py-5 space-y-4 max-w-2xl">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi di Struk & Header</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nama Usaha</label>
            <Input value={settings.businessName}
              onChange={(e) => setSettings((s) => ({ ...s, businessName: e.target.value }))}
              className="max-w-md" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Alamat</label>
            <Input value={settings.businessAddress}
              onChange={(e) => setSettings((s) => ({ ...s, businessAddress: e.target.value }))}
              placeholder="Jl. example No. 1, Kota"
              className="max-w-md" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nomor Telepon</label>
            <Input value={settings.businessPhone}
              onChange={(e) => setSettings((s) => ({ ...s, businessPhone: e.target.value }))}
              placeholder="08xxxxxxxxxx"
              className="max-w-md" />
          </div>
        </div>
      </div>

      {/* Export Data Card */}
      <div className="card px-5 py-5 space-y-3 max-w-2xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Backup Data</p>
        <p className="text-sm text-muted-foreground">Export semua transaksi ke file Excel untuk backup.</p>
        <Button onClick={handleExport} disabled={exporting} className="btn-success">
          <Download className="w-4 h-4 mr-1" />
          {exporting ? 'Mengeksport...' : 'Export Semua Data (Excel)'}
        </Button>
      </div>

      {/* Clear Data Card */}
      <div className="card border-red-200 bg-red-50 px-5 py-5 space-y-3 max-w-2xl">
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Zona Bahaya
        </p>
        <p className="text-sm text-red-600">Hapus SEMUA transaksi dari database. Tindakan ini TIDAK DAPAT dibatalkan.</p>
        <Button onClick={() => setClearConfirm(true)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-100">
          <Trash2 className="w-4 h-4 mr-1" /> Hapus Semua Data
        </Button>
      </div>

      {/* Confirmation Dialog 1 */}
      {clearConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-sm p-6 space-y-4 text-center">
            <div className="bg-red-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Konfirmasi Penghapusan</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Anda akan menghapus SEMUA data transaksi. Ini <span className="font-bold text-red-500">TIDAK DAPAT dibatalkan</span>.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setClearConfirm(false)} variant="outline" className="flex-1">Batal</Button>
              <Button onClick={() => { setClearConfirm(false); setClearConfirm2(true) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">Ya, Hapus Semua</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog 2 - Final Warning */}
      {clearConfirm2 && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="card max-w-sm p-6 space-y-4 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">PERINGATAN TERAKHIR</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Ini adalah peringatan terakhir. Setelah dihapus, data tidak bisa dikembalikan.
              </p>
              <p className="text-xs text-red-500 mt-1 font-semibold">Anda YAKIN ingin melanjutkan?</p>
            </div>
            {clearError && (
              <div className="bg-red-100 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-xl">{clearError}</div>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setClearConfirm2(false)} variant="outline" className="flex-1">Batal</Button>
              <Button onClick={handleClearAllData} disabled={clearing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {clearing ? 'Menghapus...' : 'YA, HAPUS SEMUA DATA'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}