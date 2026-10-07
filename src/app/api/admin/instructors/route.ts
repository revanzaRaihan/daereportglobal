import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { 
  isUserAdmin, 
  getInstructorsOverview, 
  inviteInstructor 
} from '@/lib/instructorAuth'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Harap masuk terlebih dahulu.' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya administrator cabang yang dapat melihat daftar instruktur.' }, { status: 403 })
    }

    const data = await getInstructorsOverview()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API Error in GET /api/admin/instructors:', err)
    return NextResponse.json({ error: err.message || 'Gagal memuat daftar instruktur.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Harap masuk terlebih dahulu.' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya administrator cabang yang dapat mengundang instruktur.' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, role } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Harap masukkan alamat email yang valid.' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const result = await inviteInstructor({
      email,
      name,
      role: role === 'admin' ? 'admin' : 'teacher',
      invitedBy: user.id,
      origin
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('API Error in POST /api/admin/instructors:', err)
    return NextResponse.json({ error: err.message || 'Gagal mengirimkan undangan aktivasi.' }, { status: 500 })
  }
}
