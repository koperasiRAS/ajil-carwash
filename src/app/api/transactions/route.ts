import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { generateInvoiceNumber } from '@/lib/invoice'

export const dynamic = 'force-dynamic'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500)
  const skip = (page - 1) * limit

  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(`${to}T23:59:59.999Z`)
  }
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { platNomor: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        kasir: { select: { id: true, name: true } },
        voidBy: { select: { name: true } },
        items: true,
      },
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page, limit, totalPages: Math.ceil(total / limit) })
}

// ── POST ───────────────────────────────────────────────────────────────────────
const ItemSchema = z.object({
  serviceName: z.string().min(1),
  price: z.number().int().min(0),
  quantity: z.number().int().min(1).default(1),
  subtotal: z.number().int().min(0),
})

const CreateTxSchema = z.object({
  customerName: z.string().optional(),
  platNomor: z.string().min(1, 'Plat nomor wajib diisi'),
  vehicleType: z.enum(['MOTOR', 'MOBIL', 'PICKUP', 'TRUK']),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'QRIS']),
  items: z.array(ItemSchema).min(1),
  subtotal: z.number().int().min(0),
  discount: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  paymentAmount: z.number().int().min(0),
  change: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const parsed = CreateTxSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const data = parsed.data

    // Validate cash payment
    if (data.paymentMethod === 'CASH' && data.paymentAmount < data.total) {
      return NextResponse.json(
        { error: 'Jumlah bayar kurang dari total' },
        { status: 400 }
      )
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
        kasirId: session.userId,
        platNomor: data.platNomor,
        customerName: data.customerName ?? null,
        vehicleType: data.vehicleType,
        paymentMethod: data.paymentMethod,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        paymentAmount: data.paymentAmount,
        change: data.change,
        status: 'COMPLETED',
        items: {
          create: data.items.map((item) => ({
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

    return NextResponse.json(tx, { status: 201 })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}