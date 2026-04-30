import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Auth ────────────────────────────────────────────────────────────────
async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── GET ────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const kasirId = searchParams.get('kasirId')
  const status = searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (from || to) {
    where.openedAt = {}
    if (from) (where.openedAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.openedAt as Record<string, unknown>).lte = new Date(`${to}T23:59:59.999Z`)
  }
  if (kasirId) where.kasirId = kasirId
  if (status) where.status = status

  const [shifts, kasirs] = await Promise.all([
    prisma.shift.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      include: {
        kasir: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
        transactions: {
          where: { status: 'COMPLETED' },
          select: { total: true, paymentMethod: true },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Compute omzet and expected cash per shift
  const withOmzet = shifts.map((sh) => {
    const txList = sh.transactions
    const totalOmzet = txList.reduce((s, t) => s + t.total, 0)
    const cashTotal = txList.filter((t) => t.paymentMethod === 'CASH').reduce((s, t) => s + t.total, 0)
    const expectedCash = sh.status === 'CLOSED' && sh.expectedCash != null
      ? sh.expectedCash
      : (sh.openingCash + cashTotal)
    return {
      ...sh,
      transactions: undefined,
      totalOmzet,
      cashTotal,
      expectedCash,
    }
  })

  return NextResponse.json({ shifts: withOmzet, kasirs })
}