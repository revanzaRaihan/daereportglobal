import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isUserAdmin, isEmailWhitelisted } from '@/lib/instructorAuth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const oauthError = searchParams.get('error')
  const oauthErrorDesc = searchParams.get('error_description')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = (!isLocalEnv && forwardedHost) 
    ? `${forwardedProto}://${forwardedHost}` 
    : origin

  if (oauthError || oauthErrorDesc) {
    console.error('[Auth Callback] OAuth Error from provider/Supabase:', oauthError, oauthErrorDesc)
    const detailMsg = oauthErrorDesc || oauthError || 'Otentikasi ditolak oleh provider.'
    return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed&details=${encodeURIComponent(detailMsg)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] exchangeCodeForSession failed:', error.message)
      return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed&details=${encodeURIComponent(error.message)}`)
    }

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
            `${baseUrl}/login?error=not_whitelisted&email=${encodeURIComponent(user.email)}`
          )
        }
      }
    }

    return NextResponse.redirect(`${baseUrl}${next}`)
  }

  // If code is missing and no explicit error
  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`)
}
