import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userName, entityId, newData } = body

    await createAuditLog({
      userId,
      userName,
      action: 'TRANSACTION_CREATE',
      entity: 'Transaction',
      entityId,
      newData,
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Transaction audit error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}