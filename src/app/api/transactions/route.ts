import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { generateInvoiceNumber } from '@/lib/invoice'

export const dynamic = 'force-dynamic'

// ── Auth helpers ────────────────────────────────────────────────────────
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
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const skip = (page - 1) * limit

  const kasirId = searchParams.get('kasirId')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (kasirId) where.kasirId = kasirId
  if (status) where.status = status
  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(`${to}T23:59:59.999Z`)
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        kasir: { select: { id: true, name: true } },
        items: true,
        voidBy: { select: { name: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) })
}

// ── POST ──────────────────────────────────────────────────────────────
const ItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  price: z.number().int().min(0),
  quantity: z.number().int().min(1).default(1),
  subtotal: z.number().int().min(0),
})

const CreateTxSchema = z.object({
  shiftId: z.string(),
  customerName: z.string().optional(),
  vehicleType: z.enum(['MOTOR', 'MOBIL', 'PICKUP', 'TRUK']),
  vehiclePlate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'QRIS']),
  items: z.array(ItemSchema).min(1),
  subtotal: z.number().int().min(0),
  discount: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  paymentAmount: z.number().int().min(0),
  change: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const parsed = CreateTxSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const data = parsed.data

    // Verify shift is open
    const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } })
    if (!shift || shift.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau belum dibuka' }, { status: 400 })
    }

    // Generate unique invoice
    let invoiceNumber = generateInvoiceNumber()
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.transaction.findUnique({ where: { invoiceNumber } })
      if (!existing) break
      invoiceNumber = generateInvoiceNumber()
      attempts++
    }

    const tx = await prisma.transaction.create({
      data: {
        invoiceNumber,
        shiftId: data.shiftId,
        kasirId: user.id,
        customerName: data.customerName ?? null,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate ?? null,
        paymentMethod: data.paymentMethod,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        paymentAmount: data.paymentAmount,
        change: data.change,
        status: 'COMPLETED',
        items: {
          create: data.items.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        },
      },
      include: {
        kasir: { select: { id: true, name: true } },
        items: true,
      },
    })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'Kasir',
      action: 'TRANSACTION_CREATE',
      entity: 'Transaction',
      entityId: tx.id,
      newData: {
        invoiceNumber,
        vehicleType: data.vehicleType,
        paymentMethod: data.paymentMethod,
        total: data.total,
        itemCount: data.items.length,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    return NextResponse.json(tx, { status: 201 })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
