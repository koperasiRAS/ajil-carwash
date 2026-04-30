import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signSession, SESSION_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'

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

    // 2. Buat JWT session
    const token = await signSession({
      userId: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
    })

    // 3. Kembalikan response + set cookie
    const response = NextResponse.json({
      user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, isActive: dbUser.isActive },
      redirectTo: '/dashboard',
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS)

    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error?.message || String(error) || 'Internal server error' },
      { status: 500 }
    )
  }
}
