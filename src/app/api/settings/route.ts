import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  businessName: 'Ajil Car Wash',
  businessAddress: '',
  businessPhone: '',
  maxDiscountPercent: 0,
  sessionTimeoutMinutes: 30,
  requireVehiclePlate: false,
  requireCustomerName: false,
  waOwnerNumber: '',
  notifyOnVoid: true,
  notifyOnShiftDiff: true,
  notifyOnLowStock: true,
}

async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function getEnvSettings() {
  return {
    businessName: process.env.NEXT_PUBLIC_APP_NAME ?? DEFAULT_SETTINGS.businessName,
    businessAddress: process.env.BUSINESS_ADDRESS ?? '',
    businessPhone: process.env.BUSINESS_PHONE ?? '',
    maxDiscountPercent: parseInt(process.env.MAX_DISCOUNT_PERCENT ?? '0', 10),
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '30', 10),
    requireVehiclePlate: process.env.REQUIRE_VEHICLE_PLATE === 'true',
    requireCustomerName: process.env.REQUIRE_CUSTOMER_NAME === 'true',
    waOwnerNumber: process.env.NEXT_PUBLIC_WA_OWNER ?? '',
    notifyOnVoid: process.env.NOTIFY_ON_VOID !== 'false',
    notifyOnShiftDiff: process.env.NOTIFY_ON_SHIFT_DIFF !== 'false',
    notifyOnLowStock: process.env.NOTIFY_ON_LOW_STOCK !== 'false',
  }
}

// ── GET ────────────────────────────────────────────────────────────────
export async function GET() {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = getEnvSettings()
  return NextResponse.json({ settings })
}

// ── PUT ────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const oldSettings = getEnvSettings()

    // Build env updates — in production these would be written to a settings table
    // For now, log all changes and return success
    const changedKeys = Object.keys(body).filter((k) => {
      return JSON.stringify(body[k]) !== JSON.stringify((oldSettings as Record<string, unknown>)[k])
    })

    if (changedKeys.length > 0) {
      await createAuditLog({
        userId: user.id,
        userName: user.user_metadata?.name as string ?? 'Admin',
        action: 'SETTING_CHANGE',
        entity: 'SystemSettings',
        entityId: 'global',
        oldData: Object.fromEntries(changedKeys.map((k) => [k, (oldSettings as Record<string, unknown>)[k]])),
        newData: Object.fromEntries(changedKeys.map((k) => [k, body[k]])),
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          request.headers.get('x-real-ip') ??
          'unknown',
      })
    }

    return NextResponse.json({ success: true, updated: changedKeys })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
