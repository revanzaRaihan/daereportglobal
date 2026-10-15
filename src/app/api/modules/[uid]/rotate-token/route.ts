import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from '@/lib/instructorAuth'
import { rotateShareToken } from '@/lib/modules/moduleService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 })
    }

    const isAdmin = isUserAdmin(user)
    const newShareToken = await rotateShareToken(uid, user.id, isAdmin)

    return NextResponse.json({
      success: true,
      share_token: newShareToken,
      message: 'Token link berbagi berhasil dirotasi. Link publik lama kini tidak berlaku lagi.'
    })
  } catch (error: any) {
    console.error('Rotate Share Token Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}
