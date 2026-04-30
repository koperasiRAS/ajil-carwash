import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── Validation ───────────────────────────────────────────────────────────────
const QuerySchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  date: z.string().optional(),
  week: z.string().optional(),
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────
function getRange(type: string, date?: string, week?: string, month?: string, from?: string, to?: string) {
  const now = date ? new Date(date) : new Date()
  const start = new Date()
  const end = new Date()

  switch (type) {
    case 'daily': {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'weekly': {
      const weekNum = parseInt((week ?? '').split('-W')[1] ?? '1', 10)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - start.getDay() + 1 + (weekNum - 1) * 7)
      end.setTime(start.getTime())
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'monthly': {
      const [y, m] = [(month ?? '').split('-')[0] ?? '', (month ?? '').split('-')[1] ?? '']
      const year = parseInt(y, 10) || now.getFullYear()
      const mon = parseInt(m, 10) || now.getMonth() + 1
      start.setFullYear(year, mon - 1, 1)
      start.setHours(0, 0, 0, 0)
      end.setFullYear(year, mon, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'custom': {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      if (from) start.setTime(new Date(from).getTime())
      if (to) end.setTime(new Date(to).getTime())
      return { start, end }
    }
    default: {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

function getHourLabel(h: number) {
  return `${h.toString().padStart(2, '0')}:00`
}

function getDayLabel(d: number) {
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d]
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = request.nextUrl
    const raw = Object.fromEntries(searchParams.entries())
    const parsed = QuerySchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid params', details: parsed.error.flatten() }, { status: 400 })
    }

    const { type, date, week, month, from, to } = parsed.data
    const { start, end } = getRange(type, date, week, month, from, to)

    // Transactions from Prisma
    const txList = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        kasir: { select: { id: true, name: true } },
        items: true,
        voidBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const completed = txList.filter((t) => t.status === 'COMPLETED')
    const voided = txList.filter((t) => t.status === 'VOIDED')

    const omzetKotor = completed.reduce((s, t) => s + t.total, 0)
    const totalDiskon = completed.reduce((s, t) => s + t.discount, 0)
    const avgTx = completed.length > 0 ? Math.round(omzetKotor / completed.length) : 0

    // Peak hours
    const hourlyOmzet: Record<number, number> = {}
    const hourlyCount: Record<number, number> = {}
    completed.forEach((t) => {
      const h = new Date(t.createdAt).getHours()
      hourlyOmzet[h] = (hourlyOmzet[h] ?? 0) + t.total
      hourlyCount[h] = (hourlyCount[h] ?? 0) + 1
    })
    const peakHour = Object.entries(hourlyCount).sort((a, b) => b[1] - a[1])[0]

    // By Service
    const serviceMap: Record<string, { name: string; count: number; omzet: number }> = {}
    completed.forEach((tx) => {
      tx.items.forEach((item) => {
        const key = item.serviceName
        if (!serviceMap[key]) serviceMap[key] = { name: item.serviceName, count: 0, omzet: 0 }
        serviceMap[key].count += item.quantity
        serviceMap[key].omzet += item.subtotal
      })
    })
    const totalServiceOmzet = Object.values(serviceMap).reduce((s, x) => s + x.omzet, 0)
    const byService = Object.entries(serviceMap)
      .map(([name, v]) => ({ serviceId: name, ...v }))
      .sort((a, b) => b.omzet - a.omzet)
      .map((v) => ({ ...v, pct: totalServiceOmzet > 0 ? Math.round((v.omzet / totalServiceOmzet) * 100) : 0 }))

    // By Payment Method
    const paymentMap: Record<string, number> = {}
    completed.forEach((tx) => {
      paymentMap[tx.paymentMethod] = (paymentMap[tx.paymentMethod] ?? 0) + tx.total
    })
    const byPayment = Object.entries(paymentMap).map(([method, amount]) => ({
      method,
      amount,
      pct: omzetKotor > 0 ? Math.round((amount / omzetKotor) * 100) : 0,
    }))

    // By Vehicle
    const vehicleMap: Record<string, { count: number; omzet: number }> = {}
    completed.forEach((tx) => {
      if (!vehicleMap[tx.vehicleType]) vehicleMap[tx.vehicleType] = { count: 0, omzet: 0 }
      vehicleMap[tx.vehicleType].count += 1
      vehicleMap[tx.vehicleType].omzet += tx.total
    })
    const byVehicle = Object.entries(vehicleMap).map(([type, v]) => ({ type, ...v }))

    // Trend
    const trend: { label: string; omzet: number; count: number }[] = []
    if (type === 'daily') {
      for (let h = 0; h < 24; h++) {
        trend.push({ label: getHourLabel(h), omzet: hourlyOmzet[h] ?? 0, count: hourlyCount[h] ?? 0 })
      }
    } else {
      const dayMap: Record<number, { omzet: number; count: number }> = {}
      completed.forEach((tx) => {
        const d = new Date(tx.createdAt).getDay()
        if (!dayMap[d]) dayMap[d] = { omzet: 0, count: 0 }
        dayMap[d].omzet += tx.total
        dayMap[d].count += 1
      })
      for (let d = 0; d < 7; d++) {
        trend.push({ label: getDayLabel(d), omzet: dayMap[d]?.omzet ?? 0, count: dayMap[d]?.count ?? 0 })
      }
    }

    return NextResponse.json({
      meta: { type, start: start.toISOString(), end: end.toISOString() },
      summary: {
        omzetKotor,
        totalDiskon,
        omzetBersih: omzetKotor,
        totalTx: completed.length,
        totalVoid: voided.length,
        avgPerTx: avgTx,
        peakHour: peakHour ? { hour: parseInt(peakHour[0], 10), count: peakHour[1] } : null,
      },
      byService,
      byPayment,
      byVehicle,
      trend,
      transactions: txList,
    })
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}