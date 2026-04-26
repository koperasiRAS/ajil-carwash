import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shiftId, diff, note } = body

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ success: false }, { status: 401 })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name ?? 'Unknown',
      action: 'SHIFT_CLOSE',
      entity: 'Shift',
      entityId: shiftId,
      newData: { diff, note },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    // Notify owner via WA if diff != 0
    if (diff && diff !== 0 && process.env.NEXT_PUBLIC_WA_OWNER) {
      const waNumber = process.env.NEXT_PUBLIC_WA_OWNER
      const sign = diff > 0 ? '+' : ''
      const msg = encodeURIComponent(
        `[CarWash] Selisih shift kasir: Rp ${Math.abs(diff).toLocaleString('id-ID')} (${sign}${diff >= 0 ? 'LEBIH' : 'KURANG'}). Catatan: ${note ?? '-'}`
      )
      // Non-blocking WA notification
      fetch(`https://wa.me/${waNumber}?text=${msg}`).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shift close error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}