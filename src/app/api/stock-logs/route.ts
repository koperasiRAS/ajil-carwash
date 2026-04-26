import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await authOwnerOrKasir()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const itemId = searchParams.get('itemId')

  const where: Record<string, unknown> = {}
  if (itemId) where.itemId = itemId

  const logs = await prisma.stockLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      item: { select: { name: true } },
    },
  })

  return NextResponse.json(logs)
}

async function authOwnerOrKasir() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
