import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isUserAdmin, isEmailWhitelisted } from '@/lib/instructorAuth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Whitelist Security Check
      const { data: { user } } = await supabase.auth.getUser()
      if (user && !next.startsWith('/auth/activate')) {
        const isAdmin = isUserAdmin(user)
        if (!isAdmin && user.email) {
          const whitelisted = await isEmailWhitelisted(user.email)
          if (!whitelisted) {
            await supabase.auth.signOut()
            const adminClient = createAdminClient()
            if (adminClient && user.id) {
              try {
                await adminClient.auth.admin.deleteUser(user.id)
              } catch {
                // Ignore
              }
            }
            return NextResponse.redirect(
              `${origin}/login?error=not_whitelisted&email=${encodeURIComponent(user.email)}`
            )
          }
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // If code exchange failed, return to login with notice
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
