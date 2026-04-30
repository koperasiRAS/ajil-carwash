import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { hash } from 'bcryptjs'

export const dynamic = 'force-dynamic'

async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const CreateSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4-6 digit angka'),
})

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
  isActive: z.boolean().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (isActive !== null && isActive !== '') where.isActive = isActive === 'true'

  const employees = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      pin: true,
      isActive: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  })

  return NextResponse.json(employees)
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })

    const existingPin = await prisma.user.findUnique({ where: { pin: parsed.data.pin } })
    if (existingPin) return NextResponse.json({ error: 'PIN sudah digunakan' }, { status: 409 })

    const hashedPassword = await hash(parsed.data.password, 12)

    const newUser = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        pin: parsed.data.pin,
        isActive: true,
      },
    })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'Admin',
      action: 'EMPLOYEE_CREATE',
      entity: 'User',
      entityId: newUser.id,
      newData: { name: parsed.data.name, email: parsed.data.email },
    })

    return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, isActive: newUser.isActive }, { status: 201 })
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

    if (data.pin && data.pin !== existing.pin) {
      const pinTaken = await prisma.user.findUnique({ where: { pin: data.pin } })
      if (pinTaken) return NextResponse.json({ error: 'PIN sudah digunakan orang lain' }, { status: 409 })
    }

    const parsed = UpdateSchema.safeParse(data)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, email: true, pin: true, isActive: true },
    })

    await createAuditLog({
      userId: user.id,
      userName: user.user_metadata?.name as string ?? 'Admin',
      action: 'EMPLOYEE_UPDATE',
      entity: 'User',
      entityId: id,
      oldData: existing,
      newData: { ...updated, changedFields: Object.keys(data) },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const user = await authUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  // Soft delete - deactivate
  await prisma.user.update({ where: { id }, data: { isActive: false } })

  await createAuditLog({
    userId: user.id,
    userName: user.user_metadata?.name as string ?? 'Admin',
    action: 'EMPLOYEE_DELETE',
    entity: 'User',
    entityId: id,
    oldData: existing,
    newData: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
