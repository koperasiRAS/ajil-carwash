import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, PoolConfig } from 'pg'
import { URL } from 'url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildPoolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL ?? ''
  try {
    const parsed = new URL(raw)
    // Prisma's Pg adapter needs proper connection string
    // Keep as-is and let pg driver handle it
    return { connectionString: raw }
  } catch {
    return { connectionString: raw }
  }
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const config = buildPoolConfig()
    // Increase timeouts for serverless cold starts
    config.connectionTimeoutMillis = 10000
    config.idleTimeoutMillis = 30000
    config.statement_timeout = 15000
    const pool = new Pool(config)
    const adapter = new PrismaPg(pool)
    globalForPrisma.prisma = new PrismaClient({ adapter } as any)
  }
  return globalForPrisma.prisma
}

const _prisma = getPrisma()
export default _prisma