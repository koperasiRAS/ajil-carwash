import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Auth helper ────────────────────────────────────────────────────────
async function authOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.user_metadata?.role as string
  if (role !== 'OWNER') return null
  return user
}

// ── GET ────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const owner = await authOwner()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const entity = searchParams.get('entity')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 50
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(`${to}T23:59:59.999Z`)
  }
  if (userId) where.userId = userId
  if (action) where.action = action
  if (entity) where.entity = entity
  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { entity: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  // Get unique users for filter dropdown
  const users = await prisma.auditLog.findMany({
    select: { user: { select: { id: true, name: true } } },
    distinct: ['userId'],
    orderBy: { user: { name: 'asc' } },
  })

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    users: users.map((u) => u.user).filter(Boolean),
  })
}
