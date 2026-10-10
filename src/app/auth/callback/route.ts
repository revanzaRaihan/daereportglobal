import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isUserAdmin, isEmailWhitelisted } from '@/lib/instructorAuth'
import { STARTER_STYLES, STARTER_RECOMMENDATIONS } from '@/lib/starterDatasets'

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

    // Whitelist Security Check (Disabled by default for Public Demo)
    const { data: { user } } = await supabase.auth.getUser()
    const isWhitelistActive = process.env.ENABLE_WHITELIST === 'true'

    if (isWhitelistActive && user && !next.startsWith('/auth/activate')) {
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

    // Public Demo Onboarding: Auto-seed starter datasets for fresh accounts
    if (user) {
      try {
        const { count } = await supabase
          .from('dataset_entries')
          .select('*', { count: 'exact', head: true })

        if (count === 0 || count === null) {
          const stylesToInsert = STARTER_STYLES.map(s => ({
            ...s,
            user_id: user.id
          }))
          await supabase.from('dataset_entries').insert(stylesToInsert)

          const recsToInsert = STARTER_RECOMMENDATIONS.map(r => ({
            ...r,
            user_id: user.id
          }))
          await supabase.from('recommendation_datasets').insert(recsToInsert)
        }
      } catch (err) {
        console.error('[Auth Callback] Auto-seed starter datasets failed:', err)
      }
    }

    return NextResponse.redirect(`${baseUrl}${next}`)
  }

  // If code is missing and no explicit error
  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`)
}
