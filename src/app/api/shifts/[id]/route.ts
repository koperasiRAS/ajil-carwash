import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      kasir: { select: { id: true, name: true } },
      transactions: {
        where: { status: { in: ['COMPLETED', 'VOIDED'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, invoiceNumber: true, total: true, paymentMethod: true, status: true, createdAt: true },
      },
      expenses: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, description: true, amount: true, category: true },
      },
    },
  })

  if (!shift) return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })

  const cashTotal = shift.transactions
    .filter((t) => t.status === 'COMPLETED' && t.paymentMethod === 'CASH')
    .reduce((s, t) => s + t.total, 0)
  const totalOmzet = shift.transactions
    .filter((t) => t.status === 'COMPLETED')
    .reduce((s, t) => s + t.total, 0)

  return NextResponse.json({
    shift: {
      ...shift,
      totalOmzet,
      cashTotal,
    },
  })
}
