import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          request.nextUrl.pathname = pathname
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoggedIn = !!user

  // /login → redirect if already authenticated
  if (pathname === '/login') {
    if (isLoggedIn) {
      const role = (user?.user_metadata?.role as string) ?? 'KASIR'
      const redirectUrl = role === 'OWNER' ? '/dashboard' : '/kasir'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
    return NextResponse.next()
  }

  // Unauthenticated → /login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = (user?.user_metadata?.role as string) ?? 'KASIR'

  // Owner-only routes
  const ownerRoutes = [
    '/dashboard', '/transactions', '/reports', '/services',
    '/employees', '/shifts', '/stock', '/expenses', '/settings',
  ]
  if (ownerRoutes.some((r) => pathname.startsWith(r)) && role !== 'OWNER') {
    return NextResponse.redirect(new URL('/kasir', request.url))
  }

  // Kasir routes — both KASIR and OWNER allowed
  const kasirRoutes = ['/kasir', '/shift']
  if (kasirRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
