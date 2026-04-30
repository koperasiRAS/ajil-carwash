'use client'

import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey?: keyof T
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyDescription?: string
  loading?: boolean
  pageSize?: number
  className?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey = 'id' as keyof T,
  onRowClick,
  emptyTitle = 'Tidak ada data',
  emptyDescription,
  loading = false,
  pageSize = 20,
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const va = a[sortKey]
        const vb = b[sortKey]
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va ?? '').localeCompare(String(vb ?? ''))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const visibleCols = columns.filter((c) => !c.hideOnMobile)

  if (loading) {
    return (
      <div className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col.key as string} className={cn('text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider', col.className)}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {columns.map((col) => (
                    <td key={col.key as string} className="px-4 py-3">
                      <div className="h-4 skeleton rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-card border border-border rounded-xl overflow-hidden flex flex-col', className)}>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th key={col.key as string} className={cn('text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider', col.className)}>
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key as string)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : paged.map((row, i) => (
              <tr
                key={String(row[rowKey] ?? i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border/50 transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''
                )}
              >
                {columns.map((col) => (
                  <td key={col.key as string} className={cn('px-4 py-3 text-foreground', col.className)}>
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3 p-4 flex-1 overflow-y-auto bg-muted/10">
        {paged.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : paged.map((row, i) => (
          <div
            key={String(row[rowKey] ?? i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'bg-card border border-border rounded-lg p-4 shadow-sm flex flex-col gap-2',
              onRowClick ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''
            )}
          >
            {visibleCols.map((col) => (
              <div key={col.key as string} className="flex justify-between items-start gap-2 text-sm">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider shrink-0 mt-0.5">
                  {col.header}
                </span>
                <div className={cn('text-right text-foreground font-medium break-all', col.className)}>
                  {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '—')}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground bg-card shrink-0">
          <span className="hidden sm:inline">
            Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} dari {sorted.length}
          </span>
          <span className="sm:hidden">
            Hal {page} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => setPage(1)} disabled={page <= 1}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs hidden sm:inline">{page} / {totalPages}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable