import { createAdminClient } from '@/utils/supabase/admin'
import { generateUlid } from '@/lib/ulid'
import { SYSTEM_FRAMEWORK_PRESETS } from './presets'
import { 
  LearningFramework, 
  LearningModule, 
  LearningModuleSource,
  AiGeneratedModulePayload 
} from './types'

const DEFAULT_BRANCH_ID = 1

/**
 * Fallback memory / app_settings helper when tables are not yet created in Supabase.
 */
async function getFallbackModules(): Promise<LearningModule[]> {
  const adminClient = createAdminClient()
  if (!adminClient) return []
  try {
    const { data } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'cache_learning_modules')
      .maybeSingle()
    if (!data?.value) return []
    return JSON.parse(data.value) as LearningModule[]
  } catch {
    return []
  }
}

async function saveFallbackModules(modules: LearningModule[]): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) return
  try {
    await adminClient
      .from('app_settings')
      .upsert({
        key: 'cache_learning_modules',
        value: JSON.stringify(modules),
        updated_at: new Date().toISOString()
      })
  } catch (err) {
    console.error('Failed to save fallback modules to app_settings:', err)
  }
}

/**
 * Get all available learning frameworks (global presets + branch custom frameworks).
 */
export async function getFrameworks(branchId: number = DEFAULT_BRANCH_ID): Promise<LearningFramework[]> {
  const adminClient = createAdminClient()
  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_frameworks')
        .select('*')
        .eq('is_active', true)
        .or(`branch_id.is.null,branch_id.eq.${branchId}`)
        .order('id', { ascending: true })

      if (!error && data && data.length > 0) {
        return data as LearningFramework[]
      }
    } catch {
      // Table may not exist yet, fallback below
    }
  }

  // Graceful fallback to static system framework presets
  return SYSTEM_FRAMEWORK_PRESETS.map((preset, index) => ({
    id: index + 1,
    uid: preset.uid,
    branch_id: preset.branch_id,
    code: preset.code,
    name: preset.name,
    schema_structure: preset.schema_structure,
    is_active: preset.is_active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))
}

export interface ListModulesFilter {
  branchId?: number
  userId: string
  isAdmin: boolean
  subject?: string
  gradeLevel?: string
  frameworkCode?: string
  languageCode?: 'id' | 'en'
  status?: 'draft' | 'published' | 'archived'
  search?: string
}

/**
 * List learning modules with strict tenant isolation, RBAC, and search filters.
 */
export async function getModules(filter: ListModulesFilter): Promise<LearningModule[]> {
  const branchId = filter.branchId || DEFAULT_BRANCH_ID
  const adminClient = createAdminClient()

  if (adminClient) {
    try {
      let query = adminClient
        .from('learning_modules')
        .select(`
          *,
          framework:learning_frameworks(id, code, name)
        `)
        .eq('branch_id', branchId)
        .is('deleted_at', null)

      // RBAC: Non-admins can only see their own modules OR published branch modules
      if (!filter.isAdmin) {
        query = query.or(`author_id.eq.${filter.userId},and(status.eq.published,visibility_scope.eq.branch)`)
      }

      if (filter.subject) {
        query = query.eq('subject_name', filter.subject)
      }
      if (filter.gradeLevel) {
        query = query.eq('grade_level', filter.gradeLevel)
      }
      if (filter.languageCode) {
        query = query.eq('language_code', filter.languageCode)
      }
      if (filter.status) {
        query = query.eq('status', filter.status)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (!error && data) {
        const frameworks = await getFrameworks(branchId)
        const frameworkMap = new Map(frameworks.map(f => [f.id, f]))

        let list: LearningModule[] = data.map((item: any) => {
          const fw = item.framework || frameworkMap.get(item.framework_id)
          return {
            id: item.id,
            uid: item.uid,
            branch_id: item.branch_id,
            author_id: item.author_id,
            framework_id: item.framework_id,
            subject_name: item.subject_name,
            grade_level: item.grade_level,
            topic_title: item.topic_title,
            language_code: item.language_code,
            duration_minutes: item.duration_minutes,
            teacher_guide_json: item.teacher_guide_json,
            student_handout_json: item.student_handout_json,
            report_seed_json: item.report_seed_json,
            visibility_scope: item.visibility_scope,
            status: item.status,
            created_at: item.created_at,
            updated_at: item.updated_at,
            deleted_at: item.deleted_at,
            framework_code: fw?.code || '',
            framework_name: fw?.name || ''
          }
        })

        // In-memory frameworkCode & search filter
        if (filter.frameworkCode) {
          list = list.filter(m => m.framework_code === filter.frameworkCode)
        }
        if (filter.search) {
          const q = filter.search.toLowerCase()
          list = list.filter(m => 
            m.topic_title.toLowerCase().includes(q) ||
            m.subject_name.toLowerCase().includes(q) ||
            m.grade_level.toLowerCase().includes(q)
          )
        }

        return list
      }
    } catch {
      // Table missing, fallback below
    }
  }

  // Fallback to app_settings storage
  const allFallback = await getFallbackModules()
  const frameworks = await getFrameworks(branchId)
  const frameworkMap = new Map(frameworks.map(f => [f.id, f]))
  const frameworkCodeMap = new Map(frameworks.map(f => [f.code, f]))

  let list = allFallback.filter(m => {
    if (m.deleted_at) return false
    if (m.branch_id !== branchId) return false
    if (!filter.isAdmin) {
      const isOwner = m.author_id === filter.userId
      const isBranchPublished = m.status === 'published' && m.visibility_scope === 'branch'
      if (!isOwner && !isBranchPublished) return false
    }
    if (filter.subject && m.subject_name !== filter.subject) return false
    if (filter.gradeLevel && m.grade_level !== filter.gradeLevel) return false
    if (filter.languageCode && m.language_code !== filter.languageCode) return false
    if (filter.status && m.status !== filter.status) return false
    return true
  })

  list = list.map(m => {
    const fw = frameworkMap.get(m.framework_id) || frameworkCodeMap.get(m.framework_code || '')
    return {
      ...m,
      framework_code: fw?.code || m.framework_code || 'kurikulum_merdeka',
      framework_name: fw?.name || m.framework_name || 'Kurikulum Merdeka'
    }
  })

  if (filter.frameworkCode) {
    list = list.filter(m => m.framework_code === filter.frameworkCode)
  }
  if (filter.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(m => 
      m.topic_title.toLowerCase().includes(q) ||
      m.subject_name.toLowerCase().includes(q) ||
      m.grade_level.toLowerCase().includes(q)
    )
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * Fetch a single module by its public Anti-IDOR UID.
 */
export async function getModuleByUid(
  uid: string, 
  userId: string, 
  isAdmin: boolean
): Promise<LearningModule | null> {
  const adminClient = createAdminClient()
  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .select(`
          *,
          framework:learning_frameworks(id, code, name)
        `)
        .eq('uid', uid)
        .is('deleted_at', null)
        .maybeSingle()

      if (!error && data) {
        // RBAC check
        const isOwner = data.author_id === userId
        const isBranchPublished = data.status === 'published' && data.visibility_scope === 'branch'
        if (!isAdmin && !isOwner && !isBranchPublished) {
          return null
        }

        return {
          id: data.id,
          uid: data.uid,
          branch_id: data.branch_id,
          author_id: data.author_id,
          framework_id: data.framework_id,
          subject_name: data.subject_name,
          grade_level: data.grade_level,
          topic_title: data.topic_title,
          language_code: data.language_code,
          duration_minutes: data.duration_minutes,
          teacher_guide_json: data.teacher_guide_json,
          student_handout_json: data.student_handout_json,
          report_seed_json: data.report_seed_json,
          visibility_scope: data.visibility_scope,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
          deleted_at: data.deleted_at,
          framework_code: data.framework?.code,
          framework_name: data.framework?.name
        }
      }
    } catch {
      // Fallback
    }
  }

  // Fallback
  const list = await getFallbackModules()
  const item = list.find(m => m.uid === uid && !m.deleted_at)
  if (!item) return null

  const isOwner = item.author_id === userId
  const isBranchPublished = item.status === 'published' && item.visibility_scope === 'branch'
  if (!isAdmin && !isOwner && !isBranchPublished) {
    return null
  }

  return item
}

/**
 * Create a new learning module.
 */
export async function createModule(
  params: {
    branchId?: number
    authorId: string
    frameworkId: number
    frameworkCode?: string
    subjectName: string
    gradeLevel: string
    topicTitle: string
    languageCode?: 'id' | 'en'
    durationMinutes?: number
    teacherGuideJson: any
    studentHandoutJson: any
    reportSeedJson: any
    visibilityScope?: 'private' | 'branch'
    status?: 'draft' | 'published' | 'archived'
  }
): Promise<LearningModule> {
  const branchId = params.branchId || DEFAULT_BRANCH_ID
  const uid = generateUlid()
  const now = new Date().toISOString()

  const moduleData: Omit<LearningModule, 'id'> = {
    uid,
    branch_id: branchId,
    author_id: params.authorId,
    framework_id: params.frameworkId,
    subject_name: params.subjectName,
    grade_level: params.gradeLevel,
    topic_title: params.topicTitle,
    language_code: params.languageCode || 'id',
    duration_minutes: params.durationMinutes || 60,
    teacher_guide_json: params.teacherGuideJson,
    student_handout_json: params.studentHandoutJson,
    report_seed_json: params.reportSeedJson,
    visibility_scope: params.visibilityScope || 'branch',
    status: params.status || 'draft',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    framework_code: params.frameworkCode
  }

  const adminClient = createAdminClient()
  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .insert({
          uid: moduleData.uid,
          branch_id: moduleData.branch_id,
          author_id: moduleData.author_id,
          framework_id: moduleData.framework_id,
          subject_name: moduleData.subject_name,
          grade_level: moduleData.grade_level,
          topic_title: moduleData.topic_title,
          language_code: moduleData.language_code,
          duration_minutes: moduleData.duration_minutes,
          teacher_guide_json: moduleData.teacher_guide_json,
          student_handout_json: moduleData.student_handout_json,
          report_seed_json: moduleData.report_seed_json,
          visibility_scope: moduleData.visibility_scope,
          status: moduleData.status,
          created_at: moduleData.created_at,
          updated_at: moduleData.updated_at
        })
        .select()
        .single()

      if (!error && data) {
        return {
          ...data,
          framework_code: params.frameworkCode
        }
      }
    } catch {
      // Table missing, save to fallback
    }
  }

  // Save to fallback store
  const fallbackList = await getFallbackModules()
  const newId = fallbackList.length > 0 ? Math.max(...fallbackList.map(m => m.id)) + 1 : 1
  const fullModule: LearningModule = {
    ...moduleData,
    id: newId
  }
  fallbackList.unshift(fullModule)
  await saveFallbackModules(fallbackList)
  return fullModule
}

/**
 * Update an existing learning module.
 */
export async function updateModule(
  uid: string,
  updates: Partial<LearningModule>,
  userId: string,
  isAdmin: boolean
): Promise<LearningModule> {
  const existing = await getModuleByUid(uid, userId, isAdmin)
  if (!existing) {
    throw new Error('Modul pembelajaran tidak ditemukan atau Anda tidak memiliki akses.')
  }

  // RBAC: Only author (if draft) or Admin can update
  if (!isAdmin && (existing.author_id !== userId || existing.status === 'published')) {
    throw new Error('Hanya pembuat modul dengan status draf atau Administrator yang dapat mengubah modul ini.')
  }

  const now = new Date().toISOString()
  const adminClient = createAdminClient()

  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .update({
          ...updates,
          updated_at: now
        })
        .eq('uid', uid)
        .select()
        .single()

      if (!error && data) {
        return data
      }
    } catch {
      // Fallback
    }
  }

  // Fallback store update
  const fallbackList = await getFallbackModules()
  const index = fallbackList.findIndex(m => m.uid === uid)
  if (index !== -1) {
    fallbackList[index] = {
      ...fallbackList[index],
      ...updates,
      updated_at: now
    }
    await saveFallbackModules(fallbackList)
    return fallbackList[index]
  }

  throw new Error('Gagal memperbarui modul pembelajaran.')
}

/**
 * Duplicate (clone & adapt) an existing module for an instructor.
 */
export async function duplicateModule(
  uid: string,
  targetUserId: string,
  branchId: number = DEFAULT_BRANCH_ID
): Promise<LearningModule> {
  const existing = await getModuleByUid(uid, targetUserId, true)
  if (!existing) {
    throw new Error('Modul rujukan tidak ditemukan.')
  }

  return await createModule({
    branchId,
    authorId: targetUserId,
    frameworkId: existing.framework_id,
    frameworkCode: existing.framework_code,
    subjectName: existing.subject_name,
    gradeLevel: existing.grade_level,
    topicTitle: `${existing.topic_title} (Salinan)`,
    languageCode: existing.language_code,
    durationMinutes: existing.duration_minutes,
    teacherGuideJson: JSON.parse(JSON.stringify(existing.teacher_guide_json)),
    studentHandoutJson: JSON.parse(JSON.stringify(existing.student_handout_json)),
    reportSeedJson: JSON.parse(JSON.stringify(existing.report_seed_json)),
    visibilityScope: 'branch',
    status: 'draft' // Cloned modules start as editable draft
  })
}

/**
 * Soft-delete a learning module.
 */
export async function deleteModule(
  uid: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  const existing = await getModuleByUid(uid, userId, isAdmin)
  if (!existing) {
    throw new Error('Modul pembelajaran tidak ditemukan.')
  }

  if (!isAdmin && (existing.author_id !== userId || existing.status === 'published')) {
    throw new Error('Hanya pembuat draf atau Administrator yang berwenang menghapus modul ini.')
  }

  const now = new Date().toISOString()
  const adminClient = createAdminClient()

  if (adminClient) {
    try {
      await adminClient
        .from('learning_modules')
        .update({ deleted_at: now, updated_at: now })
        .eq('uid', uid)
      return
    } catch {
      // Fallback
    }
  }

  const fallbackList = await getFallbackModules()
  const index = fallbackList.findIndex(m => m.uid === uid)
  if (index !== -1) {
    fallbackList[index].deleted_at = now
    await saveFallbackModules(fallbackList)
  }
}

/**
 * Safe staff offboarding: Reassign all learning modules from one instructor to another.
 */
export async function reassignInstructorModules(
  fromAuthorId: string,
  toAuthorId: string,
  branchId: number = DEFAULT_BRANCH_ID
): Promise<number> {
  const adminClient = createAdminClient()
  let count = 0

  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .update({ author_id: toAuthorId, updated_at: new Date().toISOString() })
        .eq('author_id', fromAuthorId)
        .select('id')

      if (!error && data) {
        count = data.length
      }
    } catch {
      // Fallback
    }
  }

  // Update in fallback store as well
  const fallbackList = await getFallbackModules()
  let fallbackUpdated = 0
  fallbackList.forEach(m => {
    if (m.author_id === fromAuthorId) {
      m.author_id = toAuthorId
      m.updated_at = new Date().toISOString()
      fallbackUpdated++
    }
  })
  if (fallbackUpdated > 0) {
    await saveFallbackModules(fallbackList)
  }

  return Math.max(count, fallbackUpdated)
}
