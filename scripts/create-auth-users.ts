const fs = require('fs')

// Load .env.local manually
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => {
      const idx = l.indexOf('=')
      const k = l.slice(0, idx).trim()
      const v = l.slice(idx + 1).trim()
      return [k, v]
    })
)
Object.assign(process.env, env)

const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false } }
  )

  console.log('Creating auth.users via Supabase Admin API...\n')

  const users = [
    { email: 'admin@carwash.com', password: 'Admin123!', name: 'Admin', pin: '1234' },
  ]

  for (const u of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, pin: u.pin, is_active: true },
    })

    if (error) {
      if (
        error.message.includes('already been registered') ||
        error.message.includes('already exists') ||
        error.message.includes('duplicate')
      ) {
        console.log(`[SKIP] ${u.email} — already exists`)
      } else {
        console.error(`[ERROR] ${u.email}: ${error.message}`)
      }
    } else {
      console.log(`[CREATED] ${u.email} → id: ${data.user.id}`)
    }
  }

  console.log('\n=== Done ===')
  console.log('Admin: admin@carwash.com / Admin123! (PIN: 1234)')
}

main().catch(console.error).finally(() => process.exit(0))
