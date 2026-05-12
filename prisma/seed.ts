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

  // ── Service Packages ────────────────────────────────────────────────────────
  const serviceDefs = [
    // Motor
    { name: 'Motor Kecil', vehicleType: 'MOTOR' as const, price: 20000, sortOrder: 1 },
    { name: 'Motor Besar', vehicleType: 'MOTOR' as const, price: 25000, sortOrder: 2 },
    // Mobil
    { name: 'Express Wash', vehicleType: 'MOBIL' as const, price: 30000, sortOrder: 1 },
    { name: 'Hydraulic Wash', vehicleType: 'MOBIL' as const, price: 40000, sortOrder: 2 },
    { name: 'Premium Wash', vehicleType: 'MOBIL' as const, price: 50000, sortOrder: 3 },
    // Pickup
    { name: 'Express Wash', vehicleType: 'PICKUP' as const, price: 30000, sortOrder: 1 },
    { name: 'Hydraulic Wash', vehicleType: 'PICKUP' as const, price: 40000, sortOrder: 2 },
    { name: 'Premium Wash', vehicleType: 'PICKUP' as const, price: 50000, sortOrder: 3 },
    // Truk
    { name: 'Express Wash', vehicleType: 'TRUK' as const, price: 30000, sortOrder: 1 },
    { name: 'Hydraulic Wash', vehicleType: 'TRUK' as const, price: 40000, sortOrder: 2 },
    { name: 'Premium Wash', vehicleType: 'TRUK' as const, price: 50000, sortOrder: 3 },
  ]
  console.log(`✓ ${serviceDefs.length} service packages defined (hardcoded in kasir/page.tsx)`)

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
