'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  sheets?: { name: string; data: Record<string, unknown>[] }[]
  className?: string
}

export function ExportButton({ data, filename, sheets, className }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function exportExcel() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      if (sheets && sheets.length > 0) {
        for (const sheet of sheets) {
          const ws = XLSX.utils.json_to_sheet(sheet.data)
          XLSX.utils.book_append_sheet(wb, ws, sheet.name)
        }
      } else {
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, 'Data')
      }

      XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  async function exportPDF() {
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape' })
      const pageW = doc.internal.pageSize.getWidth()

      if (data.length === 0) return

      const headers = Object.keys(data[0])
      const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')))

      // @ts-ignore
      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 86, 219] },
      })

      doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          className={className}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
        </DropdownMenuItem>
        {data.length > 0 && (
          <DropdownMenuItem onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" /> Export PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportButton