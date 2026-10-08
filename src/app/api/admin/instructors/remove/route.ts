import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin, removeInstructorMember } from '@/lib/instructorAuth'
import { logServerAuditEvent } from '@/lib/auditLogger'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat menghapus akses instruktur.' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, instructorName, instructorEmail } = body

    if (!userId) {
      return NextResponse.json({ error: 'ID instruktur wajib disertakan.' }, { status: 400 })
    }

    await removeInstructorMember(userId, user.id)

    await logServerAuditEvent({
      userId: user.id,
      userEmail: user.email || null,
      userName: user.user_metadata?.teacher_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
      action: 'remove_instructor',
      entityType: 'instructor',
      entityId: userId,
      description: `Menghapus akses akun instruktur ${instructorName || instructorEmail || userId}`,
      details: { target_user_id: userId, instructor_email: instructorEmail, instructor_name: instructorName }
    })

    return NextResponse.json({ success: true, message: 'Akses instruktur berhasil dihapus.' })
  } catch (err: any) {
    console.error('API Error in /api/admin/instructors/remove:', err)
    return NextResponse.json({ error: err.message || 'Gagal menghapus instruktur.' }, { status: 500 })
  }
}
