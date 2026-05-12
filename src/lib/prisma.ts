import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, PoolConfig } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildPoolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL ?? ''
  let connectionString = raw
  if (connectionString && !connectionString.includes('pgbouncer=true')) {
    connectionString += connectionString.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true'
  }

  return {
    connectionString,
    // Increase timeouts for serverless cold starts
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Max connections for serverless (Supabase pooler handles the rest)
    max: 1,
  }
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const pool = new Pool(buildPoolConfig())
    const adapter = new PrismaPg(pool)
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    } as any)
  }
  return globalForPrisma.prisma
}

const _prisma = getPrisma()
export default _prisma