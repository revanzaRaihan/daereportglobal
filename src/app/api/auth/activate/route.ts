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
    const { username, password, email } = body

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json({ error: 'Nama/Username pengajar harus minimal 2 karakter.' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Kata sandi baru minimal 6 karakter.' }, { status: 400 })
    }

    // 1. Check if user is authenticated from current session
    let { data: { user } } = await supabase.auth.getUser()

    // 2. If not in session, find user by email
    if (!user && email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      user = usersData?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase()) || null
    }

    if (!user) {
      return NextResponse.json({
        error: 'Sesi aktivasi tidak ditemukan atau telah kedaluwarsa. Silakan buka tautan aktivasi dari email Anda kembali.'
      }, { status: 400 })
    }

    const trimmedUsername = username.trim()

    // 3. Update password and teacher metadata
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: password,
      user_metadata: {
        ...(user.user_metadata || {}),
        teacher_name: trimmedUsername,
        full_name: trimmedUsername,
        name: trimmedUsername
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
