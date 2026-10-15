import { createAdminClient } from '@/utils/supabase/admin'
import { generateUlid, generateShareToken } from '@/lib/ulid'
import { APP_CONFIG } from '@/lib/branding'
import { SYSTEM_FRAMEWORK_PRESETS } from './presets'
import { 
  LearningFramework, 
  LearningModule, 
  PublicLearnerModule,
  StudentArticleJson,
  StudentLkpdJson,
  TeacherGuideJson,
  ReportSeedJson
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
    const parsed = JSON.parse(data.value) as any[]
    return parsed.map(normalizeModuleV2)
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
 * Normalizes a module record to ensure complete V2 LMS Article & LKPD structure.
 */
export function normalizeModuleV2(item: any): LearningModule {
  const shareToken = item.share_token || generateShareToken()
  const topicSubtitle = item.topic_subtitle || 'Eksplorasi Konsep & Lembar Kerja Mandiri'
  const isLinkShared = item.is_link_shared !== undefined ? Boolean(item.is_link_shared) : true
  const showHintsOnWeb = item.show_hints_on_web !== undefined ? Boolean(item.show_hints_on_web) : true

  // Synthesize student_article_json if missing (from legacy student_handout_json)
  let studentArticle: StudentArticleJson = item.student_article_json
  if (!studentArticle && item.student_handout_json) {
    studentArticle = {
      hero_callout: {
        emoji: '🚀',
        title: 'Tujuan & Relevansi Dunia Nyata',
        body: item.student_handout_json.concept_summary || 'Pelajari konsep inti pada sesi pembelajaran kali ini dengan pendekatan interaktif.'
      },
      article_sections: [
        {
          section_order: 1,
          heading: 'Pemahaman Konsep & Eksplorasi',
          content_markdown: item.student_handout_json.concept_summary || 'Pelajari konsep dan terapkan dalam latihan mandiri.',
          fun_callout_box: {
            type: 'pro_tip',
            title: 'Tips Guru',
            content: 'Fokus pada pemahaman logika dan coba bereksperimen dengan contoh yang diberikan.'
          },
          worked_example: item.student_handout_json.worked_example ? {
            scenario: item.student_handout_json.worked_example.problem || 'Studi Kasus Pembelajaran',
            steps: item.student_handout_json.worked_example.step_by_step_solution || ['Langkah 1: Analisis masalah', 'Langkah 2: Terapkan solusi'],
            takeaway: 'Uji setiap langkah secara bertahap.'
          } : null
        }
      ],
      key_vocabulary: [
        { term: item.subject_name || 'Materi', simple_definition: 'Fokus bidang pembelajaran pada modul ini.' }
      ]
    }
  }

  // Synthesize student_lkpd_json if missing (from legacy student_handout_json)
  let studentLkpd: StudentLkpdJson = item.student_lkpd_json
  if (!studentLkpd && item.student_handout_json) {
    studentLkpd = {
      missions: (item.student_handout_json.worksheet_activities || []).map((act: any, idx: number) => ({
        mission_number: act.activity_number || idx + 1,
        mission_title: `Misi ${act.activity_number || idx + 1}: ${act.activity_type === 'creative_challenge' ? 'Boss Challenge' : (idx === 0 ? 'Pemanasan' : 'Latihan Inti')}`,
        mission_type: idx === 0 ? 'warm_up' : (idx === 1 ? 'core_practice' : 'boss_challenge'),
        instruction: act.instruction || '',
        interactive_hint: 'Coba baca kembali ringkasan materi dan worked example di atas.',
        workspace_placeholder: act.workspace_prompt || 'Tuliskan jawaban atau kode solusi Anda di sini...'
      })),
      self_reflection_check: [
        'Saya dapat menjelaskan konsep utama dengan kata-kata sendiri.',
        'Saya menyelesaikan tantangan misi pemanasan dan latihan inti.'
      ]
    }
  }

  // Fallback defaults if still empty
  if (!studentArticle) {
    studentArticle = {
      hero_callout: { emoji: '🚀', title: 'Why Does This Matter?', body: 'Pelajari konsep penting ini untuk meningkatkan pemahaman Anda.' },
      article_sections: [
        {
          section_order: 1,
          heading: 'Pengenalan Materi',
          content_markdown: 'Modul ini memandu Anda memahami topik ini secara terstruktur.',
          fun_callout_box: { type: 'fun_fact', title: 'Tahukah Kamu?', content: 'Konsep ini banyak digunakan dalam industri modern.' },
          worked_example: { scenario: 'Contoh', steps: ['Langkah 1'], takeaway: 'Pahami polanya.' }
        }
      ],
      key_vocabulary: [{ term: 'Konsep Dasar', simple_definition: 'Prinsip utama yang dipelajari.' }]
    }
  }

  if (!studentLkpd) {
    studentLkpd = {
      missions: [
        {
          mission_number: 1,
          mission_title: 'Misi 1: Pemanasan Konsep',
          mission_type: 'warm_up',
          instruction: 'Selesaikan tantangan awal untuk memverifikasi pemahaman Anda.',
          interactive_hint: 'Tinjau kembali bagian artikel di atas.',
          workspace_placeholder: 'Tuliskan jawaban Anda di sini...'
        }
      ],
      self_reflection_check: ['Saya memahami materi modul ini dengan baik.']
    }
  }

  return {
    ...item,
    share_token: shareToken,
    topic_subtitle: topicSubtitle,
    is_link_shared: isLinkShared,
    show_hints_on_web: showHintsOnWeb,
    student_article_json: studentArticle,
    student_lkpd_json: studentLkpd,
    teacher_guide_json: item.teacher_guide_json || {
      learning_objectives: [],
      icebreaker_hook: '',
      timeline_steps: [],
      common_misconceptions: [],
      answer_keys: []
    },
    report_seed_json: item.report_seed_json || {
      pillar_1_milestone_summary: '',
      pillar_3_recommended_practice: ''
    }
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
          const normalized = normalizeModuleV2(item)
          return {
            ...normalized,
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
            (m.topic_subtitle && m.topic_subtitle.toLowerCase().includes(q)) ||
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
      (m.topic_subtitle && m.topic_subtitle.toLowerCase().includes(q)) ||
      m.subject_name.toLowerCase().includes(q) ||
      m.grade_level.toLowerCase().includes(q)
    )
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * Fetch a single module by its internal studio UID.
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

        const normalized = normalizeModuleV2(data)
        return {
          ...normalized,
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
 * Fetch a public sanitized module by its zero-login share token.
 * SECURITY GUARDRAIL: Teacher Guide and Answer Keys are completely stripped!
 */
export async function getPublicModuleByShareToken(token: string): Promise<PublicLearnerModule | null> {
  if (!token || typeof token !== 'string') return null
  const cleanToken = token.trim()

  const adminClient = createAdminClient()
  let rawModule: any = null

  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .select(`
          share_token,
          topic_title,
          topic_subtitle,
          subject_name,
          grade_level,
          duration_minutes,
          language_code,
          student_article_json,
          student_lkpd_json,
          student_handout_json,
          is_link_shared,
          show_hints_on_web,
          deleted_at,
          framework:learning_frameworks(name)
        `)
        .eq('share_token', cleanToken)
        .is('deleted_at', null)
        .maybeSingle()

      if (!error && data) {
        rawModule = data
      }
    } catch {
      // Fallback
    }
  }

  if (!rawModule) {
    const list = await getFallbackModules()
    rawModule = list.find(m => m.share_token === cleanToken && !m.deleted_at)
  }

  if (!rawModule) return null

  // If sharing is revoked/disabled, refuse public access
  if (rawModule.is_link_shared === false) return null

  const normalized = normalizeModuleV2(rawModule)

  const estimatedMins = Math.max(5, Math.round((normalized.duration_minutes || 60) * 0.25))

  return {
    share_token: normalized.share_token,
    topic_title: normalized.topic_title,
    topic_subtitle: normalized.topic_subtitle || 'Eksplorasi Konsep & Lembar Kerja Mandiri',
    subject_name: normalized.subject_name,
    grade_level: normalized.grade_level,
    duration_minutes: normalized.duration_minutes,
    language_code: normalized.language_code,
    estimated_read_mins: estimatedMins,
    difficulty_badge: normalized.duration_minutes > 75 ? 'Challenger' : (normalized.duration_minutes > 45 ? 'Intermediate' : 'Beginner'),
    curriculum_tags: [normalized.framework_name || normalized.subject_name, normalized.grade_level],
    student_article_json: normalized.student_article_json,
    student_lkpd_json: normalized.student_lkpd_json,
    show_hints_on_web: normalized.show_hints_on_web,
    framework_name: normalized.framework_name,
    branch_name: APP_CONFIG.name,
    institution_logo: APP_CONFIG.logoPath
  }
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
    topicSubtitle?: string
    languageCode?: 'id' | 'en'
    durationMinutes?: number
    teacherGuideJson: TeacherGuideJson
    studentArticleJson?: StudentArticleJson
    studentLkpdJson?: StudentLkpdJson
    studentHandoutJson?: any
    reportSeedJson: ReportSeedJson
    isLinkShared?: boolean
    showHintsOnWeb?: boolean
    visibilityScope?: 'private' | 'branch'
    status?: 'draft' | 'published' | 'archived'
  }
): Promise<LearningModule> {
  const branchId = params.branchId || DEFAULT_BRANCH_ID
  const uid = generateUlid()
  const shareToken = generateShareToken()
  const now = new Date().toISOString()

  const normalized = normalizeModuleV2({
    uid,
    share_token: shareToken,
    branch_id: branchId,
    author_id: params.authorId,
    framework_id: params.frameworkId,
    subject_name: params.subjectName,
    grade_level: params.gradeLevel,
    topic_title: params.topicTitle,
    topic_subtitle: params.topicSubtitle || 'Eksplorasi Konsep & Lembar Kerja Mandiri',
    language_code: params.languageCode || 'id',
    duration_minutes: params.durationMinutes || 60,
    teacher_guide_json: params.teacherGuideJson,
    student_article_json: params.studentArticleJson,
    student_lkpd_json: params.studentLkpdJson,
    student_handout_json: params.studentHandoutJson,
    report_seed_json: params.reportSeedJson,
    is_link_shared: params.isLinkShared !== undefined ? params.isLinkShared : true,
    show_hints_on_web: params.showHintsOnWeb !== undefined ? params.showHintsOnWeb : true,
    visibility_scope: params.visibilityScope || 'branch',
    status: params.status || 'draft',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    framework_code: params.frameworkCode
  })

  const adminClient = createAdminClient()
  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('learning_modules')
        .insert({
          uid: normalized.uid,
          share_token: normalized.share_token,
          branch_id: normalized.branch_id,
          author_id: normalized.author_id,
          framework_id: normalized.framework_id,
          subject_name: normalized.subject_name,
          grade_level: normalized.grade_level,
          topic_title: normalized.topic_title,
          topic_subtitle: normalized.topic_subtitle,
          language_code: normalized.language_code,
          duration_minutes: normalized.duration_minutes,
          teacher_guide_json: normalized.teacher_guide_json,
          student_article_json: normalized.student_article_json,
          student_lkpd_json: normalized.student_lkpd_json,
          student_handout_json: normalized.student_handout_json,
          report_seed_json: normalized.report_seed_json,
          is_link_shared: normalized.is_link_shared,
          show_hints_on_web: normalized.show_hints_on_web,
          visibility_scope: normalized.visibility_scope,
          status: normalized.status,
          created_at: normalized.created_at,
          updated_at: normalized.updated_at
        })
        .select()
        .single()

      if (!error && data) {
        return {
          ...normalizeModuleV2(data),
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
    ...normalized,
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
        return normalizeModuleV2(data)
      }
    } catch {
      // Fallback
    }
  }

  // Fallback store update
  const fallbackList = await getFallbackModules()
  const index = fallbackList.findIndex(m => m.uid === uid)
  if (index !== -1) {
    fallbackList[index] = normalizeModuleV2({
      ...fallbackList[index],
      ...updates,
      updated_at: now
    })
    await saveFallbackModules(fallbackList)
    return fallbackList[index]
  }

  throw new Error('Gagal memperbarui modul pembelajaran.')
}

/**
 * Regenerates / rotates the share_token for a module to immediately revoke existing public links.
 */
export async function rotateShareToken(
  uid: string,
  userId: string,
  isAdmin: boolean
): Promise<string> {
  const newToken = generateShareToken()
  await updateModule(uid, { share_token: newToken }, userId, isAdmin)
  return newToken
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
    topicSubtitle: existing.topic_subtitle || undefined,
    languageCode: existing.language_code,
    durationMinutes: existing.duration_minutes,
    teacherGuideJson: JSON.parse(JSON.stringify(existing.teacher_guide_json)),
    studentArticleJson: JSON.parse(JSON.stringify(existing.student_article_json)),
    studentLkpdJson: JSON.parse(JSON.stringify(existing.student_lkpd_json)),
    studentHandoutJson: existing.student_handout_json ? JSON.parse(JSON.stringify(existing.student_handout_json)) : undefined,
    reportSeedJson: JSON.parse(JSON.stringify(existing.report_seed_json)),
    isLinkShared: true,
    showHintsOnWeb: existing.show_hints_on_web,
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
