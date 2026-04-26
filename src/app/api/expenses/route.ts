import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function authOwnerOrKasir() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

const CreateExpenseSchema = z.object({
  category: z.enum(['OPERASIONAL', 'GAJI', 'SABUN_CHEMICAL', 'LISTRIK_AIR', 'PERALATAN', 'LAINNYA']),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  amount: z.number().int().min(1, 'Jumlah minimal 1'),
  note: z.string().optional(),
  shiftId: z.string().uuid().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')
  const kasirId = searchParams.get('kasirId')

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (kasirId) where.kasirId = kasirId
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
    }
  }

  const [expenses, totalAmount] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        kasir: { select: { id: true, name: true } },
        shift: { select: { id: true, openedAt: true } },
      },
    }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ])

  return NextResponse.json({
    expenses,
    totalAmount: totalAmount._sum.amount ?? 0,
  })
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const parsed = CreateExpenseSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    // If no shiftId provided, find active shift for this kasir
    let shiftId = parsed.data.shiftId
    if (!shiftId) {
      const activeShift = await prisma.shift.findFirst({
        where: { kasirId: user.id, status: 'OPEN' },
      })
      if (!activeShift) {
        return NextResponse.json({ error: 'Tidak ada shift aktif. Buka shift terlebih dahulu.' }, { status: 400 })
      }
      shiftId = activeShift.id
    }

    const expense = await prisma.expense.create({
      data: {
        kasirId: user.id,
        shiftId,
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
      },
    })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'User',
      action: 'EXPENSE_CREATE',
      entity: 'Expense',
      entityId: expense.id,
      newData: parsed.data,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Create expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
