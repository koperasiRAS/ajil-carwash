import 'dotenv/config'
import { PrismaClient, VehicleType } from '@prisma/client'
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
      pin: '1234',
      isActive: true,
    },
  })
  console.log('Created admin:', admin.email)

  // Create Services
  const services = [
    // MOTOR
    { name: 'Cuci Motor Reguler', description: 'Cuci motor reguler', price: 15000, category: VehicleType.MOTOR, durationMinutes: 20 },
    { name: 'Cuci Motor Salon', description: 'Cuci motor salon lengkap', price: 25000, category: VehicleType.MOTOR, durationMinutes: 30 },
    { name: 'Cuci + Wax Motor', description: 'Cuci motor + wax', price: 35000, category: VehicleType.MOTOR, durationMinutes: 40 },
    // MOBIL
    { name: 'Cuci Mobil Reguler', description: 'Cuci mobil reguler', price: 30000, category: VehicleType.MOBIL, durationMinutes: 30 },
    { name: 'Cuci Mobil Salon', description: 'Cuci mobil salon lengkap', price: 50000, category: VehicleType.MOBIL, durationMinutes: 45 },
    { name: 'Cuci + Wax Mobil', description: 'Cuci mobil + wax', price: 70000, category: VehicleType.MOBIL, durationMinutes: 60 },
    { name: 'Poles Mobil', description: 'Poles mobil full', price: 150000, category: VehicleType.MOBIL, durationMinutes: 90 },
    { name: 'Interior Cleaning', description: 'Cleaning interior mobil', price: 100000, category: VehicleType.MOBIL, durationMinutes: 60 },
    // PICKUP
    { name: 'Cuci Pickup', description: 'Cuci pickup', price: 45000, category: VehicleType.PICKUP, durationMinutes: 40 },
    // TRUK
    { name: 'Cuci Truk', description: 'Cuci truk', price: 75000, category: VehicleType.TRUK, durationMinutes: 60 },
  ]

  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } })
    if (!existing) {
      await prisma.service.create({ data: service })
    }
  }
  console.log('Created services:', services.length)

  // Create Stock Items
  const stockItems = [
    { name: 'Sabun Cair', unit: 'liter', currentStock: 20, minStock: 5, pricePerUnit: 25000 },
    { name: 'Shampo Mobil', unit: 'liter', currentStock: 10, minStock: 3, pricePerUnit: 35000 },
    { name: 'Semir Ban', unit: 'botol', currentStock: 15, minStock: 5, pricePerUnit: 20000 },
    { name: 'Lap Microfiber', unit: 'pcs', currentStock: 30, minStock: 10, pricePerUnit: 15000 },
    { name: 'Wax', unit: 'kg', currentStock: 5, minStock: 2, pricePerUnit: 50000 },
  ]

  for (const item of stockItems) {
    const existing = await prisma.stockItem.findFirst({ where: { name: item.name } })
    if (!existing) {
      await prisma.stockItem.create({ data: item })
    }
  }
  console.log('Created stock items:', stockItems.length)

  console.log('Seed completed!')
  console.log('')
  console.log('=== Login Credentials ===')
  console.log('Admin: admin@carwash.com (PIN: 1234)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
