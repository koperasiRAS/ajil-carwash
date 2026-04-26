import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Validation ──────────────────────────────────────────────────────────
const QuerySchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  date: z.string().optional(),
  week: z.string().optional(),
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ── Helpers ──────────────────────────────────────────────────────────────
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
      // week format: 2026-W17
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

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.user_metadata?.role as string
    if (role !== 'OWNER') return NextResponse.json({ error: 'Hanya owner' }, { status: 403 })

    const { searchParams } = request.nextUrl
    const raw = Object.fromEntries(searchParams.entries())
    const parsed = QuerySchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid params', details: parsed.error.flatten() }, { status: 400 })
    }

    const { type, date, week, month, from, to } = parsed.data
    const { start, end } = getRange(type, date, week, month, from, to)

    // ── Transactions ──────────────────────────────────────────────────
    const { data: txList } = await supabase
      .from('transactions')
      .select(`
        id, kasir_id, total, subtotal, discount, payment_method, vehicle_type,
        created_at, status, void_reason,
        users!kasir_id(id, name),
        transaction_items(service_name, service_id, subtotal)
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const completed = (txList ?? []).filter((t) => t.status === 'COMPLETED')
    const voided = (txList ?? []).filter((t) => t.status === 'VOIDED')

    const omzetKotor = completed.reduce((s, t) => s + t.total, 0)
    const totalDiskon = completed.reduce((s, t) => s + t.discount, 0)
    const omzetBersih = omzetKotor
    const avgTx = completed.length > 0 ? Math.round(omzetKotor / completed.length) : 0

    // Peak hours
    const hourlyOmzet: Record<number, number> = {}
    const hourlyCount: Record<number, number> = {}
    completed.forEach((t) => {
      const h = new Date(t.created_at).getHours()
      hourlyOmzet[h] = (hourlyOmzet[h] ?? 0) + t.total
      hourlyCount[h] = (hourlyCount[h] ?? 0) + 1
    })
    const peakHour = Object.entries(hourlyCount).sort((a, b) => b[1] - a[1])[0]

    // ── By Service ────────────────────────────────────────────────────
    const serviceMap: Record<string, { name: string; count: number; omzet: number }> = {}
    completed.forEach((tx) => {
      ;(tx.transaction_items ?? []).forEach((item: { service_name: string; service_id: string; subtotal: number }) => {
        const key = item.service_id
        if (!serviceMap[key]) serviceMap[key] = { name: item.service_name, count: 0, omzet: 0 }
        serviceMap[key].count += 1
        serviceMap[key].omzet += item.subtotal
      })
    })
    const byService = Object.entries(serviceMap)
      .map(([id, v]) => ({ serviceId: id, ...v }))
      .sort((a, b) => b.omzet - a.omzet)
      .map((v, _, arr) => ({ ...v, pct: arr.reduce((s, x) => s + x.omzet, 0) > 0 ? Math.round((v.omzet / arr.reduce((s, x) => s + x.omzet, 0)) * 100) : 0 }))

    // ── By Kasir ───────────────────────────────────────────────────────
    const kasirMap: Record<string, { name: string; txCount: number; omzet: number; diskon: number; voidCount: number }> = {}
    txList?.forEach((tx) => {
      const kid = tx.kasir_id
      const kuname = (tx.users as unknown as { name: string })?.name ?? 'Unknown'
      if (!kasirMap[kid]) kasirMap[kid] = { name: kuname, txCount: 0, omzet: 0, diskon: 0, voidCount: 0 }
      if (tx.status === 'COMPLETED') {
        kasirMap[kid].txCount += 1
        kasirMap[kid].omzet += tx.total
        kasirMap[kid].diskon += tx.discount
      } else {
        kasirMap[kid].voidCount += 1
      }
    })
    const byKasir = Object.values(kasirMap).sort((a, b) => b.omzet - a.omzet)

    // ── By Payment Method ─────────────────────────────────────────────
    const paymentMap: Record<string, number> = {}
    completed.forEach((tx) => {
      paymentMap[tx.payment_method] = (paymentMap[tx.payment_method] ?? 0) + tx.total
    })
    const byPayment = Object.entries(paymentMap).map(([method, amount]) => ({
      method,
      amount,
      pct: omzetKotor > 0 ? Math.round((amount / omzetKotor) * 100) : 0,
    }))

    // ── By Vehicle ────────────────────────────────────────────────────
    const vehicleMap: Record<string, { count: number; omzet: number }> = {}
    completed.forEach((tx) => {
      if (!vehicleMap[tx.vehicle_type]) vehicleMap[tx.vehicle_type] = { count: 0, omzet: 0 }
      vehicleMap[tx.vehicle_type].count += 1
      vehicleMap[tx.vehicle_type].omzet += tx.total
    })
    const byVehicle = Object.entries(vehicleMap).map(([type, v]) => ({ type, ...v }))

    // ── Hourly / Daily trend ──────────────────────────────────────────
    const trend: { label: string; omzet: number; count: number }[] = []
    if (type === 'daily') {
      for (let h = 0; h < 24; h++) {
        trend.push({ label: getHourLabel(h), omzet: hourlyOmzet[h] ?? 0, count: hourlyCount[h] ?? 0 })
      }
    } else {
      const dayMap: Record<number, { omzet: number; count: number }> = {}
      completed.forEach((tx) => {
        const d = new Date(tx.created_at).getDay()
        if (!dayMap[d]) dayMap[d] = { omzet: 0, count: 0 }
        dayMap[d].omzet += tx.total
        dayMap[d].count += 1
      })
      for (let d = 0; d < 7; d++) {
        trend.push({ label: getDayLabel(d), omzet: dayMap[d]?.omzet ?? 0, count: dayMap[d]?.count ?? 0 })
      }
    }

    // ── Expenses ───────────────────────────────────────────────────────
    const { data: expenseList } = await supabase
      .from('expenses')
      .select('id, amount, category, description, created_at, users!kasir_id(name)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const totalExpenses = (expenseList ?? []).reduce((s, e) => s + e.amount, 0)

    const expenseByCategory: Record<string, number> = {}
    ;(expenseList ?? []).forEach((e) => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount
    })

    const expenses = (expenseList ?? []).map((e) => ({
      id: e.id,
      amount: e.amount,
      category: e.category,
      description: e.description,
      createdAt: e.created_at,
      inputBy: (e.users as unknown as { name: string })?.name ?? '-',
    }))

    // ── Estimate Laba ─────────────────────────────────────────────────
    const estimasiLaba = omzetBersih - totalExpenses

    return NextResponse.json({
      meta: {
        type,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        omzetKotor,
        totalDiskon,
        omzetBersih,
        totalExpenses,
        estimasiLaba,
        totalTx: completed.length,
        totalVoid: voided.length,
        avgPerTx: avgTx,
        peakHour: peakHour ? { hour: parseInt(peakHour[0], 10), count: peakHour[1] } : null,
      },
      byService,
      byKasir,
      byPayment,
      byVehicle,
      trend,
      expenses,
      expenseByCategory,
    })
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
