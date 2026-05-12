import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

// Changed from POST to DELETE with confirmation token safeguard
export async function DELETE(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const confirm = request.nextUrl.searchParams.get('confirm')
  if (confirm !== 'DELETE_ALL_TRANSACTIONS') {
    return NextResponse.json(
      { error: 'Confirmation required. Pass ?confirm=DELETE_ALL_TRANSACTIONS' },
      { status: 400 }
    )
  }

  try {
    // Delete all transactions in a single transaction
    // TransactionItems will cascade delete automatically (onDelete: Cascade in schema)
    const count = await prisma.$transaction(async (tx) => {
      const n = await tx.transaction.count()
      await tx.transaction.deleteMany({})
      return n
    })

    logger.info('All transactions cleared', { count, userId: session.userId })

    revalidatePath('/', 'layout')
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/reports')

    return NextResponse.json({ success: true, message: `${count} transaksi berhasil dihapus.` })
  } catch (error) {
    logger.error('Clear all transactions error', { error: String(error), userId: session?.userId })
    return NextResponse.json(
      { error: 'Gagal menghapus data transaksi. Pastikan tidak ada proses lain yang sedang mengakses data.' },
      { status: 500 }
    )
  }
}
