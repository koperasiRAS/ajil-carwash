import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/shifts/active
// Auth: KASIR — return own OPEN shift or null
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shift = await prisma.shift.findFirst({
    where: {
      kasirId: user.id,
      status: 'OPEN',
    },
    include: {
      kasir: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
  })

  if (!shift) return NextResponse.json({ shift: null })

  // Calculate omzet for this shift
  const txList = await prisma.transaction.findMany({
    where: { shiftId: shift.id, status: 'COMPLETED' },
    select: { total: true, paymentMethod: true },
  })
  const omzet = txList.reduce((s, t) => s + t.total, 0)
  const cashTx = txList.filter((t) => t.paymentMethod === 'CASH').reduce((s, t) => s + t.total, 0)
  const expectedCash = shift.openingCash + cashTx

  return NextResponse.json({
    shift: {
      ...shift,
      txCount: shift._count.transactions,
      omzet,
      expectedCash,
    },
  })
}

// POST /api/shifts/active — open new shift
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { openingCash } = body

    if (typeof openingCash !== 'number' || openingCash < 0) {
      return NextResponse.json({ error: 'Kas awal harus angka >= 0' }, { status: 400 })
    }

    // Check no existing OPEN shift
    const existing = await prisma.shift.findFirst({
      where: { kasirId: user.id, status: 'OPEN' },
    })
    if (existing) {
      return NextResponse.json({ error: 'Sudah ada shift terbuka. Tutup shift sebelumnya dulu.' }, { status: 409 })
    }

    const shift = await prisma.shift.create({
      data: {
        kasirId: user.id,
        openingCash: openingCash,
        status: 'OPEN',
      },
      include: { kasir: { select: { id: true, name: true } } },
    })

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit')
    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'Kasir',
      action: 'SHIFT_OPEN',
      entity: 'Shift',
      entityId: shift.id,
      newData: { openingCash },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    return NextResponse.json({ shift }, { status: 201 })
  } catch (error) {
    console.error('Open shift error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
