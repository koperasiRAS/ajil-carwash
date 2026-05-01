import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()

  // Delete the session cookie using cookies().delete() to ensure it's properly cleared
  cookieStore.delete(SESSION_COOKIE_NAME)

  // Also set it with maxAge: 0 to double-clear it (defense in depth)
  const response = NextResponse.json({ success: true, message: 'Logged out' })
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Immediately expire the cookie
  })

  return response
}
