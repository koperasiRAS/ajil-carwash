import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use Prisma transaction to delete items first (respect FK constraint),
    // then transactions. This is more reliable than raw SQL CASCADE.
    await prisma.$transaction(async (tx) => {
      // Delete all transaction items
      await tx.transactionItem.deleteMany({})
      // Delete all transactions
      await tx.transaction.deleteMany({})
    })

    // Invalidate Next.js cache so dashboard, transactions, and reports
    // pages get fresh data immediately
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/reports')

    return NextResponse.json({ success: true, message: 'Semua data transaksi berhasil dihapus.' })
  } catch (error: any) {
    console.error('Clear all data error:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal menghapus data' },
      { status: 500 }
    )
  }
}