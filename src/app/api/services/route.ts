import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Auth ───────────────────────────────────────────────────────────────
async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Validation ─────────────────────────────────────────────────────────
const CreateSchema = z.object({
  name: z.string().min(1, 'Nama layanan wajib diisi'),
  description: z.string().optional(),
  price: z.number().int().min(0, 'Harga minimal 0'),
  category: z.enum(['MOTOR', 'MOBIL', 'PICKUP', 'TRUK']),
  durationMinutes: z.number().int().min(1).default(30),
  isActive: z.boolean().default(true),
})

const UpdateSchema = CreateSchema.partial()

// ── GET ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (isActive !== null) where.isActive = isActive === 'true'

  const services = await prisma.service.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { transactionItems: true } },
    },
  })

  return NextResponse.json(services)
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const existing = await prisma.service.findFirst({
      where: { name: parsed.data.name, category: parsed.data.category },
    })
    if (existing) {
      return NextResponse.json({ error: 'Layanan dengan nama dan kategori ini sudah ada' }, { status: 409 })
    }

    const service = await prisma.service.create({ data: parsed.data })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'Admin',
      action: 'SERVICE_CREATE',
      entity: 'Service',
      entityId: service.id,
      newData: parsed.data,
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Create service error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    const existing = await prisma.service.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Layanan tidak ditemukan' }, { status: 404 })

    // Check price change
    if (data.price !== undefined && data.price !== existing.price) {
      // Check if has transactions
      const hasTx = await prisma.transactionItem.findFirst({
        where: { serviceId: id },
      })
      if (hasTx) {
        // Record price change in audit
        await createAuditLog({
          userId: user.id,
          userName: user.user_metadata?.name as string ?? 'Admin',
          action: 'PRICE_CHANGE',
          entity: 'Service',
          entityId: id,
          oldData: { price: existing.price },
          newData: { price: data.price, serviceName: existing.name },
        })
      }
    }

    const parsed = UpdateSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const updated = await prisma.service.update({ where: { id }, data: parsed.data })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update service error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

  const existing = await prisma.service.findUnique({
    where: { id },
    include: { _count: { select: { transactionItems: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Layanan tidak ditemukan' }, { status: 404 })

  if (existing._count.transactionItems > 0) {
    return NextResponse.json({
      error: 'Tidak bisa menghapus layanan yang sudah punya transaksi. Nonaktifkan saja.'
    }, { status: 409 })
  }

  // Soft delete
  await prisma.service.update({ where: { id }, data: { isActive: false } })

  await createAuditLog({
    userId: user.id,
    userName: user.user_metadata?.name as string ?? 'Admin',
    action: 'SERVICE_DELETE',
    entity: 'Service',
    entityId: id,
    oldData: { name: existing.name, isActive: existing.isActive },
    newData: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
