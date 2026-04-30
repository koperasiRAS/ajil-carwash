import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

interface LoginRequestBody {
  pin: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LoginRequestBody
    const { pin } = body

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'PIN harus 4-6 digit' }, { status: 400 })
    }

    // 1. Validasi PIN terhadap database
    const dbUser = await prisma.user.findUnique({
      where: { pin },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'PIN tidak valid' }, { status: 401 })
    }

    if (!dbUser.isActive) {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 })
    }

    // 2. Setup Supabase admin client untuk create session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey)

    // 3. Pastikan user ada di Supabase Auth
    const { data: authUser } = await supabaseAdmin.auth.admin.listUsers()
    let targetAuthUser = authUser.users.find(u => u.email === dbUser.email)

    if (!targetAuthUser) {
      // Buat user baru di Supabase Auth
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dbUser.email,
        email_confirm: true,
        user_metadata: { name: dbUser.name, is_active: true },
      })

      if (createError || !newAuthUser) {
        console.error('Failed to create auth user:', createError)
        return NextResponse.json({ error: 'Gagal membuat sesi auth' }, { status: 500 })
      }
      targetAuthUser = newAuthUser
    }

    // 4. Buat session via admin API → dapat refresh_token cookie
    const sessionRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${targetAuthUser.id}/sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
      }
    )

    // Jika endpoint tidak tersedia, fallback dengan cookies manual
    let response: NextResponse

    if (sessionRes.ok) {
      const setCookieHeader = sessionRes.headers.get('set-cookie') ?? ''
      response = NextResponse.json({
        user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, isActive: dbUser.isActive },
        redirectTo: '/dashboard',
      })
      if (setCookieHeader) response.headers.set('set-cookie', setCookieHeader)
    } else {
      // Fallback: set cookie manual dengan data user
      const sessionData = JSON.stringify({ id: dbUser.id, name: dbUser.name, email: dbUser.email })
      response = NextResponse.json({
        user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, isActive: dbUser.isActive },
        redirectTo: '/dashboard',
      })
      response.cookies.set('cw_session', Buffer.from(sessionData).toString('base64'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })
    }

    // 5. Audit log (non-blocking)
    createAuditLog({
      userId: dbUser.id,
      userName: dbUser.name,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: dbUser.id,
    }).catch(() => {})

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
