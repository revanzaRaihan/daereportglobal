import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin, resendInvite } from '@/lib/instructorAuth'
import { logServerAuditEvent } from '@/lib/auditLogger'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat mengirim ulang undangan.' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const result = await resendInvite({ email, origin })

    await logServerAuditEvent({
      userId: user.id,
      userEmail: user.email || null,
      userName: user.user_metadata?.teacher_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
      action: 'resend_invite',
      entityType: 'invite',
      description: `Mengirim ulang tautan aktivasi instruktur ke ${email}`,
      details: { email }
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('API Error in /api/admin/instructors/resend:', err)
    return NextResponse.json({ error: err.message || 'Gagal mengirim ulang undangan.' }, { status: 500 })
  }
}
