import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params
    const supabase = await createClient()

    // Auth check — only OWNER
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get full transaction data BEFORE void
    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*, transaction_items(*), users!kasir_id(*)')
      .eq('id', txId)
      .single()

    if (fetchErr || !tx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    if (tx.status === 'VOIDED') {
      return NextResponse.json({ error: 'Transaksi sudah divoid sebelumnya' }, { status: 400 })
    }

    // Parse body
    const body = await request.json()
    const { reasonType, reason } = body

    if (!reason || reason.trim().length < 20) {
      return NextResponse.json({ error: 'Alasan void minimal 20 karakter' }, { status: 400 })
    }

    const voidReason = `[${reasonType ?? 'LAINNYA'}] ${reason.trim()}`
    const now = new Date().toISOString()

    // Update transaction to VOIDED
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        status: 'VOIDED',
        void_reason: voidReason,
        void_by_id: user.id,
        void_at: now,
      })
      .eq('id', txId)

    if (updateErr) {
      return NextResponse.json({ error: 'Gagal mengupdate transaksi' }, { status: 500 })
    }

    // Audit log — store complete old data
    const userName = user.user_metadata?.name as string ?? 'Owner'
    await createAuditLog({
      userId: user.id,
      userName,
      action: 'TRANSACTION_VOID',
      entity: 'Transaction',
      entityId: txId,
      oldData: {
        status: tx.status,
        total: tx.total,
        invoiceNumber: tx.invoice_number,
        vehicleType: tx.vehicle_type,
        items: tx.transaction_items,
        createdAt: tx.created_at,
      },
      newData: {
        status: 'VOIDED',
        voidReason,
        voidById: user.id,
        voidByName: userName,
        voidAt: now,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown',
    })

    // WA notification — if not voided by owner themselves (owner already knows)
    const waNumber = process.env.NEXT_PUBLIC_WA_OWNER
    if (waNumber && tx.kasir_id !== user.id) {
      const kasirName = (tx.users as unknown as { name: string })?.name ?? 'Unknown'
      const msg = encodeURIComponent(
        `[CarWash ANTI-MANIPULASI]\n🚫 TRANSAKSI DIVOID\n\nInvoice: ${tx.invoice_number}\nKasir: ${kasirName}\nTotal: Rp ${tx.total.toLocaleString('id-ID')}\nAlasan: ${voidReason}\nDi-void oleh: ${userName}\nWaktu: ${new Date(now).toLocaleString('id-ID')}`
      )
      fetch(`https://wa.me/${waNumber}?text=${msg}`).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: txId,
        status: 'VOIDED',
        voidReason,
        voidAt: now,
      },
    })
  } catch (error) {
    console.error('Void transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
