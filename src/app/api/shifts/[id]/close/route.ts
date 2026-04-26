import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST /api/shifts/[id]/close
// Auth: KASIR — only close own shift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.user_metadata?.role as string

  try {
    const body = await request.json()
    const { actualCash, note } = body

    if (typeof actualCash !== 'number' || actualCash < 0) {
      return NextResponse.json({ error: 'Kas aktual harus angka >= 0' }, { status: 400 })
    }

    // Get shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        transactions: { where: { status: 'COMPLETED' } },
      },
    })

    if (!shift) return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })

    // Auth: kasir owns shift, or owner
    if (shift.kasirId !== user.id && role !== 'OWNER') {
      return NextResponse.json({ error: 'Tidak punya akses ke shift ini' }, { status: 403 })
    }

    if (shift.status === 'CLOSED') {
      return NextResponse.json({ error: 'Shift sudah ditutup' }, { status: 400 })
    }

    // Calculate expected cash
    const cashTxTotal = shift.transactions
      .filter((t) => t.paymentMethod === 'CASH')
      .reduce((s, t) => s + t.total, 0)
    const totalOmzet = shift.transactions.reduce((s, t) => s + t.total, 0)
    const expectedCash = shift.openingCash + cashTxTotal
    const difference = actualCash - expectedCash

    // Update shift
    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: 'CLOSED',
        closingCash: actualCash,
        expectedCash,
        actualCash,
        difference,
        note: note ?? null,
        closedAt: new Date(),
      },
    })

    // Audit log
    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'User',
      action: 'SHIFT_CLOSE',
      entity: 'Shift',
      entityId: shiftId,
      oldData: { status: shift.status, openingCash: shift.openingCash },
      newData: { actualCash, expectedCash, difference, note, totalOmzet, txCount: shift.transactions.length },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    // WA notif if diff != 0 and owner number set
    if (difference !== 0 && process.env.NEXT_PUBLIC_WA_OWNER) {
      const waNumber = process.env.NEXT_PUBLIC_WA_OWNER
      const sign = difference > 0 ? '+' : ''
      const direction = difference > 0 ? 'LEBIH' : 'KURANG'
      const kasirName = user.user_metadata?.name ?? 'Kasir'
      const msg = encodeURIComponent(
        `[CarWash] SELISIH KAS\n\nKasir: ${kasirName}\nShift: ${new Date(shift.openedAt).toLocaleDateString('id-ID')}\nKas Expected: Rp ${expectedCash.toLocaleString('id-ID')}\nKas Actual: Rp ${actualCash.toLocaleString('id-ID')}\nSelisih: Rp ${Math.abs(difference).toLocaleString('id-ID')} (${sign}${direction})\nCatatan: ${note ?? '-'}`
      )
      fetch(`https://wa.me/${waNumber}?text=${msg}`).catch(() => {})
    }

    return NextResponse.json({
      shift: {
        ...updated,
        totalOmzet,
        txCount: shift.transactions.length,
        expectedCash,
        difference,
      },
    })
  } catch (error) {
    console.error('Close shift error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
