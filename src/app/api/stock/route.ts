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

const CreateItemSchema = z.object({
  name: z.string().min(1, 'Nama item wajib diisi'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  currentStock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(5),
  pricePerUnit: z.number().int().min(0).default(0),
})

const UpdateItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  minStock: z.number().min(0).optional(),
  pricePerUnit: z.number().int().min(0).optional(),
})

const StockInSchema = z.object({
  itemId: z.string().uuid('ID item tidak valid'),
  quantity: z.number().min(0.01, 'Jumlah minimal 0.01'),
  note: z.string().optional(),
})

const AdjustmentSchema = z.object({
  itemId: z.string().uuid('ID item tidak valid'),
  actualStock: z.number().min(0, 'Stok tidak boleh negatif'),
  note: z.string().min(10, 'Catatan wajib minimal 10 karakter'),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')

  if (category === 'items') {
    const items = await prisma.stockItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  }

  const items = await prisma.stockItem.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { logs: true } },
    },
  })

  return NextResponse.json(items)
}

// ── POST — create item / stock-in ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const intent = body._intent as string

    if (intent === 'create') {
      const parsed = CreateItemSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

      const existing = await prisma.stockItem.findFirst({
        where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
      })
      if (existing) return NextResponse.json({ error: 'Item sudah ada' }, { status: 409 })

      const item = await prisma.stockItem.create({ data: parsed.data })

      await createAuditLog({
        userId: user.id,
        userName: user.user_metadata?.name as string ?? 'User',
        action: 'STOCK_CREATE',
        entity: 'StockItem',
        entityId: item.id,
        newData: parsed.data,
      })

      return NextResponse.json(item, { status: 201 })
    }

    if (intent === 'stockIn') {
      const parsed = StockInSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

      const item = await prisma.stockItem.findUnique({ where: { id: parsed.data.itemId } })
      if (!item) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

      const previousStock = item.currentStock
      const newStock = previousStock + parsed.data.quantity

      const [updatedItem, log] = await prisma.$transaction([
        prisma.stockItem.update({
          where: { id: parsed.data.itemId },
          data: { currentStock: newStock },
        }),
        prisma.stockLog.create({
          data: {
            itemId: parsed.data.itemId,
            type: 'IN',
            quantity: parsed.data.quantity,
            previousStock,
            currentStock: newStock,
            note: parsed.data.note ?? 'Stock in',
            userId: user.id,
          },
        }),
      ])

      return NextResponse.json({ item: updatedItem, log })
    }

    return NextResponse.json({ error: 'Intent tidak dikenal' }, { status: 400 })
  } catch (error) {
    console.error('Stock POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const intent = body._intent as string

    if (intent === 'adjust') {
      const parsed = AdjustmentSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

      const item = await prisma.stockItem.findUnique({ where: { id: parsed.data.itemId } })
      if (!item) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

      const previousStock = item.currentStock
      const actualStock = parsed.data.actualStock
      const quantity = actualStock - previousStock

      const [updatedItem, log] = await prisma.$transaction([
        prisma.stockItem.update({
          where: { id: parsed.data.itemId },
          data: { currentStock: actualStock },
        }),
        prisma.stockLog.create({
          data: {
            itemId: parsed.data.itemId,
            type: 'ADJUSTMENT',
            quantity,
            previousStock,
            currentStock: actualStock,
            note: parsed.data.note,
            userId: user.id,
          },
        }),
      ])

      await createAuditLog({
        userId: user.id,
        userName: user.user_metadata?.name as string ?? 'User',
        action: 'STOCK_ADJUSTMENT',
        entity: 'StockItem',
        entityId: item.id,
        oldData: { currentStock: previousStock },
        newData: { currentStock: actualStock, quantity, note: parsed.data.note },
      })

      return NextResponse.json({ item: updatedItem, log })
    }

    // Generic update (name, unit, minStock, pricePerUnit)
    const { id, _intent, ...data } = body
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    const parsed = UpdateItemSchema.safeParse(data)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const updated = await prisma.stockItem.update({ where: { id }, data: parsed.data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Stock PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

  await prisma.stockItem.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
