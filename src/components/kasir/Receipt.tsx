'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TxItem {
  serviceName: string
  price: number
  quantity: number
  subtotal: number
}

interface ReceiptData {
  invoiceNumber: string
  createdAt: string
  kasirName: string
  customerName?: string
  vehiclePlate?: string
  vehicleType: string
  items: TxItem[]
  subtotal: number
  discount: number
  total: number
  paymentAmount: number
  change: number
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS'
  businessName?: string
  businessAddress?: string
  businessPhone?: string
}

interface ReceiptProps {
  data: ReceiptData
  onPrinted?: () => void
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const PAY_LABELS: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

export function Receipt({ data, onPrinted }: ReceiptProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: ref,
    documentTitle: `Struk-${data.invoiceNumber}`,
    onAfterPrint: onPrinted,
  })

  const separator = "--------------------------------" // 32 chars for 80mm approx

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        className="border-border text-foreground hover:bg-accent w-full"
      >
        <Printer className="w-4 h-4 mr-2" /> Cetak Struk
      </Button>

      {/* Preview / print area */}
      <div
        ref={ref}
        className="receipt bg-white text-black p-4 mx-auto select-none"
        style={{ width: '300px', maxWidth: '300px', fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', lineHeight: '1.4' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{data.businessName ?? 'AJIL CAR WASH'}</div>
          <div>{data.businessAddress ?? 'Jl. Raya Utama No. 1'}</div>
          <div>{data.businessPhone ?? 'Telp: 08123456789'}</div>
        </div>

        <div style={{ whiteSpace: 'pre-wrap' }}>
          {separator}
          <div>Invoice: {data.invoiceNumber}</div>
          <div>Tanggal: {formatDate(data.createdAt)}</div>
          <div>Kasir  : {data.kasirName}</div>
          {data.customerName && <div>Pelanggan: {data.customerName}</div>}
          {data.vehiclePlate && <div>Plat   : {data.vehiclePlate}</div>}
          {separator}

          {/* Items */}
          {data.items.map((item, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <div>{item.serviceName}</div>
              <div style={{ paddingLeft: '8px' }}>
                {item.quantity} x {formatRupiah(item.price)} = {formatRupiah(item.subtotal)}
              </div>
            </div>
          ))}

          {separator}
          
          <table style={{ width: '100%', fontSize: '13px' }}>
            <tbody>
              <tr>
                <td>Subtotal:</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.subtotal)}</td>
              </tr>
              <tr>
                <td>Diskon  :</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.discount)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold' }}>
                <td>TOTAL   :</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.total)}</td>
              </tr>
            </tbody>
          </table>

          {separator}

          <table style={{ width: '100%', fontSize: '13px' }}>
            <tbody>
              <tr>
                <td>Bayar   :</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.paymentAmount)}</td>
              </tr>
              <tr>
                <td>Kembali :</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.change)}</td>
              </tr>
              <tr>
                <td>Metode  :</td>
                <td style={{ textAlign: 'right' }}>{PAY_LABELS[data.paymentMethod]}</td>
              </tr>
            </tbody>
          </table>

          {separator}
        </div>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>Terima kasih!</div>
          <div>Simpan struk sebagai bukti pembayaran</div>
          {data.businessPhone && <div>WA: {data.businessPhone}</div>}
        </div>
      </div>
    </div>
  )
}

export default Receipt