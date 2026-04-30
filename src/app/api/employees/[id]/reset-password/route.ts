import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

  // Get user email from database
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
  }

  const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return NextResponse.json({ error: 'Gagal mengirim email reset password' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
