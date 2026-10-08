import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from '@/lib/instructorAuth'
import { getAuditLogs, logServerAuditEvent, CreateAuditLogParams } from '@/lib/auditLogger'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Harap masuk terlebih dahulu.' }, { status: 401 })
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat melihat jejak audit.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100

    const logs = await getAuditLogs({ search, limit })
    return NextResponse.json({ success: true, logs })
  } catch (err: any) {
    console.error('API Error in GET /api/admin/audit-logs:', err)
    return NextResponse.json({ error: err.message || 'Gagal memuat log audit.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, entityType, entityId, description, details } = body

    if (!action || !entityType || !description) {
      return NextResponse.json({ error: 'Field action, entityType, dan description wajib disertakan.' }, { status: 400 })
    }

    const userName = 
      user.user_metadata?.teacher_name || 
      user.user_metadata?.full_name || 
      user.user_metadata?.name || 
      (user.email ? user.email.split('@')[0] : 'User')

    await logServerAuditEvent({
      userId: user.id,
      userEmail: user.email || null,
      userName,
      action,
      entityType,
      entityId,
      description,
      details
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API Error in POST /api/admin/audit-logs:', err)
    return NextResponse.json({ error: err.message || 'Gagal mencatat log audit.' }, { status: 500 })
  }
}
