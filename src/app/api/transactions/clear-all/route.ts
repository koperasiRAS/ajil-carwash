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
    // Use raw SQL to bypass any Prisma-level caching
    // DELETE items first, then transactions (respecting FK constraint)
    await prisma.$executeRaw`DELETE FROM "TransactionItem" CASCADE`
    await prisma.$executeRaw`DELETE FROM "Transaction" CASCADE`

    // Clear Next.js cache so the dashboard and reports get fresh data
    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true, message: 'Semua data transaksi berhasil dihapus.' })
  } catch (error: any) {
    console.error('Clear all data error:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal menghapus data' },
      { status: 500 }
    )
  }
}