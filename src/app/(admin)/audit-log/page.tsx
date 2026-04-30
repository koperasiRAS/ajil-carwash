'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Loader2, FileSpreadsheet, Filter,
  ChevronLeft, ChevronRight, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────
interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  entity: string
  entityId: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

interface FilterUser { id: string; name: string }

const ALL_ACTIONS = [
  'USER_LOGIN', 'USER_LOGOUT', 'SHIFT_OPEN', 'SHIFT_CLOSE',
  'TRANSACTION_CREATE', 'TRANSACTION_VOID',
  'SERVICE_CREATE', 'SERVICE_UPDATE', 'SERVICE_DELETE', 'PRICE_CHANGE',
  'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE',
  'STOCK_CREATE', 'STOCK_UPDATE', 'STOCK_ADJUSTMENT',
  'EXPENSE_CREATE', 'DISCOUNT_APPLY', 'SETTING_CHANGE',
]

const ACTION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  USER_LOGIN:        { text: 'text-gray-400',  bg: 'bg-gray-900',   border: 'border-gray-700' },
  USER_LOGOUT:        { text: 'text-gray-400',  bg: 'bg-gray-900',   border: 'border-gray-700' },
  SHIFT_OPEN:        { text: 'text-blue-400',  bg: 'bg-blue-950',   border: 'border-blue-800' },
  SHIFT_CLOSE:       { text: 'text-blue-400',  bg: 'bg-blue-950',   border: 'border-blue-800' },
  TRANSACTION_CREATE:{ text: 'text-green-400', bg: 'bg-green-950',  border: 'border-green-800' },
  TRANSACTION_VOID:  { text: 'text-red-400',   bg: 'bg-red-950',   border: 'border-red-800' },
  PRICE_CHANGE:      { text: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-800' },
  SERVICE_CREATE:    { text: 'text-teal-400',  bg: 'bg-teal-950',  border: 'border-teal-800' },
  SERVICE_UPDATE:    { text: 'text-teal-400',  bg: 'bg-teal-950',  border: 'border-teal-800' },
  SERVICE_DELETE:    { text: 'text-red-400',   bg: 'bg-red-950',   border: 'border-red-800' },
  EMPLOYEE_CREATE:   { text: 'text-purple-400',bg: 'bg-purple-950', border: 'border-purple-800' },
  EMPLOYEE_UPDATE:   { text: 'text-purple-400',bg: 'bg-purple-950', border: 'border-purple-800' },
  EMPLOYEE_DELETE:   { text: 'text-purple-400',bg: 'bg-purple-950', border: 'border-purple-800' },
  STOCK_CREATE:      { text: 'text-cyan-400',  bg: 'bg-cyan-950',  border: 'border-cyan-800' },
  STOCK_UPDATE:      { text: 'text-cyan-400',  bg: 'bg-cyan-950',  border: 'border-cyan-800' },
  STOCK_ADJUSTMENT:  { text: 'text-yellow-400',bg: 'bg-yellow-950',border: 'border-yellow-800' },
  EXPENSE_CREATE:    { text: 'text-red-400',   bg: 'bg-red-950',   border: 'border-red-800' },
  DISCOUNT_APPLY:    { text: 'text-yellow-400',bg: 'bg-yellow-950',border: 'border-yellow-800' },
  SETTING_CHANGE:    { text: 'text-gray-400',  bg: 'bg-gray-900',   border: 'border-gray-700' },
}

function getActionColor(action: string) {
  return ACTION_COLORS[action] ?? { text: 'text-gray-400', bg: 'bg-gray-900', border: 'border-gray-700' }
}

// ── JSON Diff Renderer ────────────────────────────────────────────────
function JsonDiff({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  if (!oldData && !newData) return <p className="text-gray-600 text-xs italic">Tidak ada detail</p>

  const allKeys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  const rows: { key: string; type: 'same' | 'added' | 'removed' | 'changed'; oldVal?: unknown; newVal?: unknown }[] = []

  allKeys.forEach((key) => {
    const oldVal = (oldData ?? {})[key]
    const newVal = (newData ?? {})[key]
    if (oldVal === undefined && newVal !== undefined) {
      rows.push({ key, type: 'added', newVal })
    } else if (oldVal !== undefined && newVal === undefined) {
      rows.push({ key, type: 'removed', oldVal })
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      rows.push({ key, type: 'changed', oldVal, newVal })
    } else {
      rows.push({ key, type: 'same', oldVal, newVal })
    }
  })

  if (rows.every((r) => r.type === 'same')) {
    return (
      <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-3 overflow-auto max-h-60">
        {JSON.stringify(newData ?? oldData, null, 2)}
      </pre>
    )
  }

  return (
    <div className="space-y-1">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 uppercase text-[10px]">
            <th className="text-left py-1 pr-3 font-medium">Field</th>
            <th className="text-left py-1 pr-3 font-medium text-red-400">Lama</th>
            <th className="text-left py-1 font-medium text-green-400">Baru</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-gray-800/40">
              <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{row.key}</td>
              <td className="py-1.5 pr-3 text-red-400 whitespace-pre-wrap break-all">
                {row.type === 'removed' || row.type === 'changed' ? JSON.stringify(row.oldVal, null, 0) : ''}
              </td>
              <td className="py-1.5 text-green-400 whitespace-pre-wrap break-all">
                {row.type === 'added' || row.type === 'changed' ? JSON.stringify(row.newVal, null, 0) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<FilterUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10))
  const [filterUser, setFilterUser] = useState('ALL')
  const [filterAction, setFilterAction] = useState('ALL')
  const [filterEntity, setFilterEntity] = useState('ALL')
  const [filterSearch, setFilterSearch] = useState('')

  // Detail modal
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterUser !== 'ALL') params.set('userId', filterUser)
      if (filterAction !== 'ALL') params.set('action', filterAction)
      if (filterEntity !== 'ALL') params.set('entity', filterEntity)
      if (filterSearch) params.set('search', filterSearch)
      params.set('page', String(page))

      const res = await fetch(`/api/audit-logs?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setLogs(json.logs ?? [])
      setUsers(json.users ?? [])
      setTotal(json.total ?? 0)
      setTotalPages(json.totalPages ?? 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterUser, filterAction, filterEntity, filterSearch, page])

  useEffect(() => { loadData() }, [loadData])

  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const rows: (string | number | null)[][] = [
      ['Waktu', 'User', 'Aksi', 'Entity', 'Entity ID', 'IP Address', 'Old Data', 'New Data'],
    ]
    logs.forEach((l) => {
      rows.push([
        new Date(l.createdAt).toLocaleString('id-ID'),
        l.userName,
        l.action,
        l.entity,
        l.entityId ?? '-',
        l.ipAddress ?? '-',
        l.oldData ? JSON.stringify(l.oldData) : '',
        l.newData ? JSON.stringify(l.newData) : '',
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log')
    XLSX.writeFile(wb, `audit-log-${filterFrom}-${filterTo}.xlsx`)
  }

  const ALL_ENTITIES = ['Transaction', 'Service', 'User', 'Shift', 'StockItem', 'SystemSettings']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-400" /> Audit Log
        </h1>
        <div className="text-xs text-gray-500">
          {total.toLocaleString('id-ID')} rekaman
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dari</label>
            <Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1) }}
              className="bg-gray-800 border-gray-700 text-white text-sm w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sampai</label>
            <Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1) }}
              className="bg-gray-800 border-gray-700 text-white text-sm w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">User</label>
            <Select value={filterUser} onValueChange={(v) => { setFilterUser(v ?? 'ALL'); setPage(1) }}>
              <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua User</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Aksi</label>
            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v ?? 'ALL'); setPage(1) }}>
              <SelectTrigger className="w-44 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Aksi</SelectItem>
                {ALL_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Entity</label>
            <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v ?? 'ALL'); setPage(1) }}>
              <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {ALL_ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">Cari</label>
            <Input value={filterSearch} onChange={(e) => { setFilterSearch(e.target.value); setPage(1) }}
              placeholder="Cari aksi atau entity..." className="bg-gray-800 border-gray-700 text-white text-sm" />
          </div>
          <Button onClick={loadData} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            <Filter className="w-4 h-4 mr-1" /> Tampilkan
          </Button>
          <Button onClick={handleExportExcel} variant="outline" size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Waktu</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Aksi</th>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Entity ID</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">IP</th>
                  <th className="text-center px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-600 py-12">Tidak ada rekaman audit log</td></tr>
                ) : logs.map((log) => {
                  const color = getActionColor(log.action)
                  return (
                    <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => setDetailLog(log)}>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('id-ID', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-white">{log.userName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${color.text} ${color.bg} border ${color.border}`}>
                          {log.action}
                          {log.action === 'PRICE_CHANGE' && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{log.entity}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                        {log.entityId ? <span className="font-mono">{log.entityId.slice(0, 8)}...</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden lg:table-cell">{log.ipAddress ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Eye className="w-4 h-4 text-gray-500 hover:text-white inline" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                Halaman {page} dari {totalPages} ({total.toLocaleString('id-ID')} rekaman)
              </p>
              <div className="flex gap-2">
                <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1} className="border-gray-700 text-gray-300">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages} className="border-gray-700 text-gray-300">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-400" />
              Detail Audit Log
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500">Waktu</p>
                  <p className="text-white">{new Date(detailLog.createdAt).toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500">User</p>
                  <p className="text-white">{detailLog.userName}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500">Entity</p>
                  <p className="text-white">{detailLog.entity} <span className="text-gray-500">#{detailLog.entityId?.slice(0, 8)}</span></p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500">IP Address</p>
                  <p className="text-white font-mono text-xs">{detailLog.ipAddress ?? '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1.5">Aksi</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium inline-block ${getActionColor(detailLog.action).text} ${getActionColor(detailLog.action).bg} border ${getActionColor(detailLog.action).border}`}>
                  {detailLog.action}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1.5">Perubahan Data</p>
                <div className="bg-gray-950 rounded-lg p-3">
                  <JsonDiff oldData={detailLog.oldData} newData={detailLog.newData} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
