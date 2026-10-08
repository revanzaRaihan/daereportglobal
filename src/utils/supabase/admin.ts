import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const rawKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY || 
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ADMIN_KEY

  const supabaseUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : ''
  const serviceRoleKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : ''

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
