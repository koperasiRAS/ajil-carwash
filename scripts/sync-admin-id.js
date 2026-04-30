require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get admin auth user id
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const adminAuth = authUsers.users.find(u => u.email === 'admin@carwash.com')
  if (!adminAuth) { console.log('Admin auth user not found'); return }
  console.log('Auth ID:', adminAuth.id)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Delete existing admin
  await pool.query('DELETE FROM "User" WHERE email = $1', ['admin@carwash.com'])
  console.log('Deleted existing admin')

  // Insert with correct id
  const hashedPassword = bcrypt.hashSync('Admin123!', 10)
  await pool.query({
    text: 'INSERT INTO "User" (id, name, email, password, pin, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
    values: [adminAuth.id, 'Admin', 'admin@carwash.com', hashedPassword, '1234', true],
  })
  console.log('Synced admin user with auth ID:', adminAuth.id)

  await pool.end()
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => process.exit(0))
