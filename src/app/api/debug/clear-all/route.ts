import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Delete all transaction items first (cascade should handle this, but be explicit)
    await prisma.transactionItem.deleteMany()

    // Delete all transactions
    await prisma.transaction.deleteMany()

    return NextResponse.json({ success: true, message: 'Semua data transaksi berhasil dihapus.' })
  } catch (error: any) {
    console.error('Clear all data error:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal menghapus data' },
      { status: 500 }
    )
  }
}
