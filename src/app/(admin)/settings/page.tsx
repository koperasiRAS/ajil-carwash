'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Download, CheckCircle } from 'lucide-react'
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
  const [settings, setSettings] = useState<SystemSettings>({ businessName: 'Ajil Car Wash', businessAddress: '', businessPhone: '' })
  const [original, setOriginal] = useState<SystemSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" /> Pengaturan Sistem
        </h1>
        <div className="flex items-center gap-3">
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
          <Button onClick={handleSave} disabled={!hasChanges()}
            className="bg-blue-600 hover:bg-blue-500 text-white">
            <Save className="w-4 h-4 mr-1" />
            Simpan Perubahan
          </Button>
        </div>
      </div>

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

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3 max-w-xl">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Backup Data</p>
        <p className="text-sm text-gray-400">Export semua transaksi ke file Excel.</p>
        <Button onClick={handleExport} disabled={exporting}
          className="bg-green-600 hover:bg-green-500 text-white">
          <Download className="w-4 h-4 mr-1" />
          {exporting ? 'Mengeksport...' : 'Export Transaksi (Excel)'}
        </Button>
      </div>
    </div>
  )
}