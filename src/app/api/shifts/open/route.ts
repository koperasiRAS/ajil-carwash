import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userName, action, entity, entityId } = body

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    await createAuditLog({ userId, userName, action, entity, entityId, ipAddress })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shift audit error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
