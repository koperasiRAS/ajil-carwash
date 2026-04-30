import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function POST(request: NextRequest) {
  // ── Auth: must be logged in ───────────────────────────────────────────
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Delete transaction items first (explicit, avoids cascade edge cases)
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
