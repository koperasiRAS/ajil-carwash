import 'dotenv/config'
import { PrismaClient, VehicleType, Role, ExpenseCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ log: ['info'] } as any)

async function main() {
  console.log('Starting seed...')

  // Create OWNER user
  const ownerPassword = await bcrypt.hash('Owner123!', 10)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@carwash.com' },
    update: {},
    create: {
      name: 'Owner Carwash',
      email: 'owner@carwash.com',
      password: ownerPassword,
      role: Role.OWNER,
      isActive: true,
    },
  })
  console.log('Created owner:', owner.email)

  // Create KASIR users
  const kasir1Password = await bcrypt.hash('Kasir123!', 10)
  const kasir1 = await prisma.user.upsert({
    where: { email: 'kasir1@carwash.com' },
    update: {},
    create: {
      name: 'Kasir Satu',
      email: 'kasir1@carwash.com',
      password: kasir1Password,
      role: Role.KASIR,
      pin: '1234',
      isActive: true,
    },
  })
  console.log('Created kasir 1:', kasir1.email)

  const kasir2Password = await bcrypt.hash('Kasir123!', 10)
  const kasir2 = await prisma.user.upsert({
    where: { email: 'kasir2@carwash.com' },
    update: {},
    create: {
      name: 'Kasir Dua',
      email: 'kasir2@carwash.com',
      password: kasir2Password,
      role: Role.KASIR,
      pin: '5678',
      isActive: true,
    },
  })
  console.log('Created kasir 2:', kasir2.email)

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
    await prisma.service.upsert({
      where: { id: service.name }, // won't match, upsert by unique field
      update: {},
      create: service,
    }).catch(() => {
      // If unique constraint fails, create without upsert
    })
  }

  // Create services with unique name constraint fallback
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
  console.log('Owner: owner@carwash.com / Owner123!')
  console.log('Kasir 1: kasir1@carwash.com / Kasir123! (PIN: 1234)')
  console.log('Kasir 2: kasir2@carwash.com / Kasir123! (PIN: 5678)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })