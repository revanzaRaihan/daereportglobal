import { createAdminClient } from '@/utils/supabase/admin'

export type AuditAction =
  | 'transfer_student'
  | 'batch_transfer_students'
  | 'update_ai_settings'
  | 'invite_instructor'
  | 'revoke_invite'
  | 'resend_invite'
  | 'remove_instructor'
  | 'delete_report'
  | 'system'

export interface AuditLogItem {
  id: string
  created_at: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  action: AuditAction | string
  entity_type: string
  entity_id?: string | null
  description: string
  details?: Record<string, any>
}

export interface CreateAuditLogParams {
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  action: AuditAction | string
  entityType: 'student' | 'instructor' | 'report' | 'settings' | 'invite' | 'system'
  entityId?: string | null
  description: string
  details?: Record<string, any>
}

const FALLBACK_KEY = 'audit_logs_fallback'
const MAX_FALLBACK_ITEMS = 100

/**
 * Server-side audit event recorder.
 * Writes directly to public.audit_logs or gracefully falls back to app_settings.
 */
export async function logServerAuditEvent(params: CreateAuditLogParams): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) {
    console.warn('[AuditLogger] Supabase admin client not initialized.')
    return
  }

  const logPayload = {
    user_id: params.userId || null,
    user_email: params.userEmail || null,
    user_name: params.userName || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    description: params.description,
    details: params.details || {}
  }

  try {
    // 1. Primary write to public.audit_logs
    const { error } = await adminClient.from('audit_logs').insert([logPayload])
    if (!error) return

    // If table does not exist yet in schema cache, fallback to app_settings
    if (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('relation "public.audit_logs" does not exist')) {
      await saveToFallback(adminClient, {
        id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        created_at: new Date().toISOString(),
        ...logPayload
      })
      return
    }

    console.error('[AuditLogger] Failed to write audit log:', error.message)
  } catch (err: any) {
    console.error('[AuditLogger] Exception recording audit log:', err?.message || err)
  }
}

/**
 * Retrieves audit logs ordered by creation time descending.
 * Reads from public.audit_logs or fallback storage.
 */
export async function getAuditLogs(options?: { search?: string; limit?: number }): Promise<AuditLogItem[]> {
  const adminClient = createAdminClient()
  if (!adminClient) return []

  const limit = options?.limit || 100
  const search = options?.search?.trim().toLowerCase()

  try {
    const { data, error } = await adminClient
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error && Array.isArray(data)) {
      if (!search) return data as AuditLogItem[]
      return filterLogs(data as AuditLogItem[], search)
    }

    // Fallback storage if table not yet migrated
    return await getFromFallback(adminClient, search, limit)
  } catch {
    return await getFromFallback(adminClient, search, limit)
  }
}

function filterLogs(logs: AuditLogItem[], query: string): AuditLogItem[] {
  return logs.filter(item => {
    return (
      item.description?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.user_email?.toLowerCase().includes(query) ||
      item.user_name?.toLowerCase().includes(query) ||
      item.entity_type?.toLowerCase().includes(query)
    )
  })
}

async function saveToFallback(adminClient: any, item: AuditLogItem): Promise<void> {
  try {
    const { data } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', FALLBACK_KEY)
      .maybeSingle()

    let list: AuditLogItem[] = []
    if (data?.value) {
      try {
        list = JSON.parse(data.value)
      } catch {
        list = []
      }
    }

    list.unshift(item)
    if (list.length > MAX_FALLBACK_ITEMS) {
      list = list.slice(0, MAX_FALLBACK_ITEMS)
    }

    await adminClient.from('app_settings').upsert({
      key: FALLBACK_KEY,
      value: JSON.stringify(list)
    })
  } catch (err) {
    console.error('[AuditLogger] Fallback storage failed:', err)
  }
}

async function getFromFallback(adminClient: any, search?: string, limit: number = 100): Promise<AuditLogItem[]> {
  try {
    const { data } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', FALLBACK_KEY)
      .maybeSingle()

    if (!data?.value) return []
    const parsed: AuditLogItem[] = JSON.parse(data.value)
    const list = Array.isArray(parsed) ? parsed : []

    if (search) {
      return filterLogs(list, search).slice(0, limit)
    }
    return list.slice(0, limit)
  } catch {
    return []
  }
}
