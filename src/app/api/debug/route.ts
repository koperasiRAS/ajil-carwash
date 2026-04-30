import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const results: Record<string, string> = {}

  // 1. Check env vars exist
  results['DATABASE_URL_exists'] = String(Boolean(process.env.DATABASE_URL))
  results['JWT_SECRET_exists'] = String(Boolean(process.env.JWT_SECRET))

  // 2. Try raw pg Pool connection
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
    await pool.query('SELECT version() as v')
    results['pg_pool'] = 'OK'
    await pool.end()
  } catch (e: any) {
    results['pg_pool'] = 'FAIL: ' + e.message
  }

  // 3. Try Prisma with adapter
  try {
    const pool2 = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
    const adapter = new PrismaPg(pool2)
    const prisma = new PrismaClient({ adapter } as any)
    await prisma.$connect()
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, pin: true, isActive: true } })
    results['prisma'] = 'OK — users: ' + JSON.stringify(users)
    await prisma.$disconnect()
  } catch (e: any) {
    results['prisma'] = 'FAIL: ' + e.message
  }

  return NextResponse.json(results)
}
