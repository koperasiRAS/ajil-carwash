const fs = require('fs')
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
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

  console.log('Syncing auth.users ↔ public.User IDs...\n')

  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) { console.error('Failed to list auth users:', authErr.message); return }
  if (!authUsers?.users) { console.error('No users returned'); return }

  console.log('Auth users:')
  for (const u of authUsers.users) {
    const meta = u.user_metadata || {}
    console.log(`  ${u.email} → id: ${u.id} pin: ${meta.pin}`)
  }

  console.log('\nSyncing IDs to public.User table...')

  for (const authUser of authUsers.users) {
    const meta = authUser.user_metadata || {}
    const name = meta.name
    const pin = meta.pin

    // Find the existing user record by email
    const { data: existingUser } = await supabase
      .from('User')
      .select('id, email')
      .eq('email', authUser.email)
      .single()

    if (existingUser) {
      // Check if IDs match — if not, we need to update
      if (existingUser.id !== authUser.id) {
        console.log(`[SYNC] ${authUser.email}: User.id=${existingUser.id} → auth.id=${authUser.id}`)

        // Update the auth ID in User table
        const { error: updErr } = await supabase
          .from('User')
          .update({ id: authUser.id })
          .eq('email', authUser.email)

        if (updErr) {
          console.error(`  [ERROR updating ID for ${authUser.email}]:`, updErr.message)
        } else {
          console.log(`  [OK] Updated User.id for ${authUser.email}`)
        }
      } else {
        console.log(`[OK] ${authUser.email} — ID already matches`)
      }
    } else {
      console.log(`[CREATE] ${authUser.email} in User table`)
      const { error: insErr } = await supabase.from('User').insert({
        id: authUser.id,
        name,
        email: authUser.email,
        isActive: meta.is_active !== false,
        pin: pin ?? null,
      })
      if (insErr) {
        console.error(`  [ERROR]:`, insErr.message)
      } else {
        console.log(`  [OK] Created User record for ${authUser.email}`)
      }
    }
  }

  // Final verification
  console.log('\nFinal User table:')
  const { data: users } = await supabase.from('User').select('id, email')
  for (const u of (users || [])) {
    console.log(`  ${u.email} (${u.id})`)
  }

  console.log('\n=== Done ===')
  console.log('Users should now be able to login.')
}

main().catch(console.error).finally(() => process.exit(0))
