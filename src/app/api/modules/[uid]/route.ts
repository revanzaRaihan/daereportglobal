import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from '@/lib/instructorAuth'
import { 
  getModuleByUid, 
  updateModule, 
  deleteModule, 
  duplicateModule 
} from '@/lib/modules/moduleService'

export async function GET(
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
    const module = await getModuleByUid(uid, user.id, isAdmin)

    if (!module) {
      return NextResponse.json({ success: false, message: 'Modul tidak ditemukan atau akses ditolak.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: module })
  } catch (error: any) {
    console.error('Get Module by UID Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function PUT(
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

    const body = await request.json()
    const isAdmin = isUserAdmin(user)

    const updated = await updateModule(uid, body, user.id, isAdmin)

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Modul pembelajaran berhasil diperbarui.'
    })
  } catch (error: any) {
    console.error('Update Module Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}

export async function DELETE(
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
    await deleteModule(uid, user.id, isAdmin)

    return NextResponse.json({
      success: true,
      message: 'Modul pembelajaran berhasil dihapus.'
    })
  } catch (error: any) {
    console.error('Delete Module Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}

// POST endpoint for Duplicate & Adapt action
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

    const cloned = await duplicateModule(uid, user.id, 1)

    return NextResponse.json({
      success: true,
      data: cloned,
      message: 'Modul berhasil diduplikasi dan siap disesuaikan sebagai draf Anda.'
    })
  } catch (error: any) {
    console.error('Duplicate Module Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}
