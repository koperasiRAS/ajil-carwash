require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const newPin = '123456'

  // 1. Update pin in public.users table via Prisma DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const r = await pool.query('UPDATE "User" SET pin = $1', [newPin])
  console.log('public.users PIN updated to', newPin, '- rows:', r.rowCount)
  await pool.end()

  // 2. Update pin in auth.users metadata
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const admin = authUsers.users.find(u => u.email === 'admin@carwash.com')
  if (admin) {
    const { error } = await supabase.auth.admin.updateUserById(admin.id, {
      user_metadata: { ...admin.user_metadata, pin: newPin },
    })
    if (error) {
      console.error('Auth metadata update error:', error.message)
    } else {
      console.log('auth.users metadata updated to pin:', newPin)
    }
  } else {
    console.log('Auth user not found, skipping')
  }

  console.log('\nLogin with PIN:', newPin)
}

main()
  .catch(e => console.error(e.message))
  .finally(() => process.exit(0))
