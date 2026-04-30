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

    // 2. Setup Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey)

    // 3. Pastikan user ada di Supabase Auth
    const { data: authUser } = await supabaseAdmin.auth.admin.listUsers()
    let targetAuthUser = authUser.users.find(u => u.email === dbUser.email)

    // Password dummy untuk Supabase Auth (actual auth via PIN di database)
    const dummyPassword = `CW_${dbUser.id}_${dbUser.pin}_secret!`

    if (!targetAuthUser) {
      // Buat user baru di Supabase Auth dengan password
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dbUser.email,
        password: dummyPassword,
        email_confirm: true,
        user_metadata: { name: dbUser.name, db_id: dbUser.id, is_active: true },
      })

      if (createError || !newAuthUser) {
        console.error('Failed to create auth user:', createError)
        return NextResponse.json({ error: 'Gagal membuat sesi auth' }, { status: 500 })
      }
    } else {
      // Update password supaya selalu sinkron
      await supabaseAdmin.auth.admin.updateUserById(targetAuthUser.id, {
        password: dummyPassword,
      })
    }

    // 4. Sign in dengan password untuk mendapatkan session yang valid
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: dbUser.email,
      password: dummyPassword,
    })

    if (signInError || !signInData.session) {
      console.error('Sign in error:', signInError)
      // Fallback: return user data tanpa Supabase session
      const response = NextResponse.json({
        user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, isActive: dbUser.isActive },
        redirectTo: '/dashboard',
      })
      // Set custom session cookie sebagai fallback
      const sessionData = JSON.stringify({ id: dbUser.id, name: dbUser.name, email: dbUser.email })
      response.cookies.set('cw_session', Buffer.from(sessionData).toString('base64'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
      return response
    }

    // 5. Set Supabase session cookies
    const response = NextResponse.json({
      user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, isActive: dbUser.isActive },
      redirectTo: '/dashboard',
    })

    // Set access_token dan refresh_token sebagai cookies
    const maxAge = signInData.session.expires_in ?? 3600

    response.cookies.set('sb-access-token', signInData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    })

    response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // Set Supabase-compatible cookies (format yang dikenali @supabase/ssr)
    const supabaseRef = /https:\/\/([^.]+)/.exec(supabaseUrl)?.[1] ?? 'app'
    const cookieBase = `sb-${supabaseRef}-auth-token`
    const sessionPayload = JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + maxAge,
      expires_in: maxAge,
      token_type: 'bearer',
      user: signInData.session.user,
    })

    // Split cookie jika terlalu besar (Supabase SSR chunked cookie pattern)
    const chunkSize = 3500
    const chunks = []
    for (let i = 0; i < sessionPayload.length; i += chunkSize) {
      chunks.push(sessionPayload.substring(i, i + chunkSize))
    }

    if (chunks.length === 1) {
      response.cookies.set(cookieBase, `base64-${Buffer.from(chunks[0]).toString('base64')}`, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      })
    } else {
      chunks.forEach((chunk, i) => {
        response.cookies.set(`${cookieBase}.${i}`, `base64-${Buffer.from(chunk).toString('base64')}`, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge,
          path: '/',
        })
      })
    }

    // 6. Audit log (non-blocking)
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
