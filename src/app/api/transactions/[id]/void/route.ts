import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await context.params
    const body = await request.json()
    const reason = body.reason as string

    if (!reason || reason.length < 20) {
      return NextResponse.json({ error: 'Alasan void minimal 20 karakter.' }, { status: 400 })
    }

    // Get transaction
    const tx = await prisma.transaction.findUnique({ where: { id } })
    if (!tx) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
    if (tx.status === 'VOIDED') {
      return NextResponse.json({ error: 'Transaksi sudah di-void.' }, { status: 400 })
    }

    // Void it
    await prisma.transaction.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidReason: reason,
        voidById: session.userId,
        voidAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Void error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}