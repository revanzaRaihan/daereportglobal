import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin, revokeInvite } from '@/lib/instructorAuth'
import { logServerAuditEvent } from '@/lib/auditLogger'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat membatalkan undangan.' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 })
    }

    await revokeInvite(email)

    await logServerAuditEvent({
      userId: user.id,
      userEmail: user.email || null,
      userName: user.user_metadata?.teacher_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
      action: 'revoke_invite',
      entityType: 'invite',
      description: `Membatalkan (revoke) undangan instruktur untuk ${email}`,
      details: { email }
    })

    return NextResponse.json({ success: true, message: `Undangan untuk ${email} berhasil dibatalkan.` })
  } catch (err: any) {
    console.error('API Error in /api/admin/instructors/revoke:', err)
    return NextResponse.json({ error: err.message || 'Gagal membatalkan undangan.' }, { status: 500 })
  }
}
