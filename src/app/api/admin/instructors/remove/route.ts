import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin, removeInstructorMember } from '@/lib/instructorAuth'

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
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'ID instruktur wajib disertakan.' }, { status: 400 })
    }

    await removeInstructorMember(userId, user.id)

    return NextResponse.json({ success: true, message: 'Akses instruktur berhasil dihapus.' })
  } catch (err: any) {
    console.error('API Error in /api/admin/instructors/remove:', err)
    return NextResponse.json({ error: err.message || 'Gagal menghapus instruktur.' }, { status: 500 })
  }
}
