import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as unknown as Record<string, unknown>)

async function main() {
  console.log('Starting seed...')

  // Create Admin user
  const adminPassword = await bcrypt.hash('Admin123!', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@carwash.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@carwash.com',
      password: adminPassword,
      pin: '123456',
      isActive: true,
    },
  })
  console.log('Created admin:', admin.email)

  console.log('')
  console.log('=== Login Credentials ===')
  console.log('Admin: admin@carwash.com (PIN: 123456)')
  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
