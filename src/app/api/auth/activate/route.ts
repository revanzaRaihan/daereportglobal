import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { username, password, email, token } = body

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json({ error: 'Nama/Username pengajar harus minimal 2 karakter.' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Kata sandi baru minimal 6 karakter.' }, { status: 400 })
    }

    // 1. Check if user is authenticated from current session (magic link / invite session)
    let { data: { user } } = await supabase.auth.getUser()

    if (user && email) {
      const cleanEmail = email.trim().toLowerCase()
      if (user.email && user.email.toLowerCase() !== cleanEmail) {
        return NextResponse.json({
          error: 'Sesi yang aktif tidak cocok dengan email aktivasi yang diminta.'
        }, { status: 403 })
      }
    }

    // 2. If not in active session, find user by email with strict token & pending-invite verification
    let pendingInviteRole: 'admin' | 'teacher' = 'teacher'
    if (!user && email) {
      const cleanEmail = email.trim().toLowerCase()
      const cleanToken = typeof token === 'string' ? token.trim() : ''

      if (!cleanToken) {
        return NextResponse.json({
          error: 'Token aktivasi wajib disertakan untuk mengaktifkan akun tanpa sesi login aktif. Silakan gunakan tautan aktivasi resmi yang dikirimkan.'
        }, { status: 401 })
      }

      // Verify email is in instructor_invitations with pending status
      let isPending = false
      let expectedToken: string | null = null

      try {
        const { data: invData } = await adminClient
          .from('instructor_invitations')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle()
        if (invData && invData.status === 'pending') {
          isPending = true
          pendingInviteRole = invData.role === 'admin' ? 'admin' : 'teacher'
          expectedToken = invData.activation_token || null
        }
      } catch {
        // Fallback check
      }

      if (!isPending) {
        try {
          const { data: fallbackSetting } = await adminClient
            .from('app_settings')
            .select('value')
            .eq('key', 'instructor_whitelist')
            .maybeSingle()
          if (fallbackSetting?.value) {
            const list = JSON.parse(fallbackSetting.value)
            const matched = list.find((i: any) => i.email.toLowerCase() === cleanEmail)
            if (matched) {
              isPending = true
              pendingInviteRole = matched.role === 'admin' ? 'admin' : 'teacher'
              expectedToken = matched.actionLink || null
            }
          }
        } catch {
          // Ignore
        }
      }

      if (!isPending) {
        return NextResponse.json({
          error: 'Email ini tidak memiliki undangan aktivasi yang aktif atau akun sudah pernah diaktifkan sebelumnya.'
        }, { status: 403 })
      }

      // Strict Token Verification: prevent unauthorized account claiming
      const isTokenValid = 
        Boolean(expectedToken) && 
        (cleanToken === expectedToken || expectedToken!.includes(cleanToken) || cleanToken.includes(expectedToken!))

      if (!isTokenValid) {
        return NextResponse.json({
          error: 'Token aktivasi tidak valid atau telah kedaluwarsa. Harap minta administrator mengirim ulang undangan.'
        }, { status: 401 })
      }

      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      user = usersData?.users?.find(u => u.email?.toLowerCase() === cleanEmail) || null

      // Guard: If account has already completed sign-in in the past, reject unauthenticated reactivation
      if (user && user.last_sign_in_at) {
        return NextResponse.json({
          error: 'Akun ini sudah aktif. Silakan masuk menggunakan kata sandi Anda di halaman login.'
        }, { status: 400 })
      }
    }

    if (!user) {
      return NextResponse.json({
        error: 'Sesi aktivasi tidak ditemukan atau telah kedaluwarsa. Silakan buka tautan aktivasi dari email Anda kembali.'
      }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const targetRole = pendingInviteRole || user.app_metadata?.role || 'teacher'

    // 3. Update password, teacher metadata, and secure app_metadata.role
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: password,
      user_metadata: {
        ...(user.user_metadata || {}),
        teacher_name: trimmedUsername,
        full_name: trimmedUsername,
        name: trimmedUsername,
        role: targetRole
      },
      app_metadata: {
        ...(user.app_metadata || {}),
        role: targetRole
      },
      email_confirm: true
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // 4. Save personalized teacher name in app_settings
    try {
      await adminClient.from('app_settings').upsert({
        key: `teacher_name_${user.id}`,
        value: trimmedUsername,
        updated_at: new Date().toISOString()
      })
    } catch {
      // Ignore
    }

    // 5. Mark invitation status as 'active' in DB / fallback
    const userEmail = user.email?.toLowerCase() || ''
    try {
      await adminClient
        .from('instructor_invitations')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          name: trimmedUsername,
          updated_at: new Date().toISOString()
        })
        .eq('email', userEmail)
    } catch {
      // Ignore
    }

    // Also update fallback whitelist if present
    try {
      const { data: fallbackSetting } = await adminClient
        .from('app_settings')
        .select('value')
        .eq('key', 'instructor_whitelist')
        .maybeSingle()

      if (fallbackSetting?.value) {
        const list = JSON.parse(fallbackSetting.value)
        const updated = list.filter((i: any) => i.email.toLowerCase() !== userEmail)
        await adminClient
          .from('app_settings')
          .upsert({
            key: 'instructor_whitelist',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
          })
      }
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Akun instruktur Anda telah aktif! Anda sekarang dapat masuk ke Studio.',
      username: trimmedUsername,
      email: user.email
    })
  } catch (err: any) {
    console.error('API Error in /api/auth/activate:', err)
    return NextResponse.json({ error: err.message || 'Gagal mengaktifkan akun.' }, { status: 500 })
  }
}
