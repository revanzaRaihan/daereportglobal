// =====================================================================
// LEARNING MODULES V2 - LMS INTERACTIVE ARTICLE & LKPD TYPES
// =====================================================================

export type FunCalloutType = 'fun_fact' | 'pro_tip' | 'brain_teaser' | 'remember_this'
export type MissionType = 'warm_up' | 'core_practice' | 'boss_challenge'
export type DifficultyBadge = 'Beginner' | 'Intermediate' | 'Challenger'

export interface FunCalloutBox {
  type: FunCalloutType
  title: string
  content: string
}

export interface WorkedExampleV2 {
  scenario: string
  steps: string[]
  takeaway: string
}

export interface ArticleSection {
  section_order: number
  heading: string
  content_markdown: string
  fun_callout_box?: FunCalloutBox | null
  worked_example?: WorkedExampleV2 | null
}

export interface VocabularyItem {
  term: string
  simple_definition: string
}

export interface StudentArticleHeroCallout {
  emoji: string
  title: string
  body: string
}

export interface StudentArticleJson {
  hero_callout: StudentArticleHeroCallout
  article_sections: ArticleSection[]
  key_vocabulary: VocabularyItem[]
}

export interface LkpdMission {
  mission_number: number
  mission_title: string
  mission_type: MissionType
  instruction: string
  interactive_hint?: string
  workspace_placeholder?: string
}

export interface StudentLkpdJson {
  missions: LkpdMission[]
  self_reflection_check: string[]
}

export interface TeacherAnswerKey {
  challenge_number: number
  solution_explanation: string
}

export interface TimelineStep {
  phase: string
  duration_mins: number
  instructor_action: string
  student_activity: string
}

export interface TeacherGuideJson {
  learning_objectives: string[]
  icebreaker_hook: string
  timeline_steps: TimelineStep[]
  common_misconceptions: string[]
  answer_keys: TeacherAnswerKey[]
  hook_and_analogy?: string
  differentiation_tips?: {
    fast_learners: string
    struggling_students: string
  }
}

export interface ReportSeedJson {
  pillar_1_milestone_summary: string
  pillar_3_recommended_practice: string
}

export interface ModuleMetadata {
  topic_title: string
  topic_subtitle: string
  estimated_read_mins: number
  difficulty_badge: DifficultyBadge
  curriculum_tags: string[]
}

// Backward-compatible V1 Handout types
export interface WorksheetActivity {
  activity_number: number
  activity_type: string
  instruction: string
  workspace_prompt: string
  answer_key_for_teacher?: string
}

export interface StudentHandoutJson {
  handout_title: string
  concept_summary: string
  worked_example?: any
  worksheet_activities?: WorksheetActivity[]
}

export interface AiGeneratedModulePayload {
  metadata: ModuleMetadata
  teacher_guide_json: TeacherGuideJson
  student_article_json: StudentArticleJson
  student_lkpd_json: StudentLkpdJson
  report_seed_json: ReportSeedJson
  // Backward compatibility fields
  curriculum_alignment?: any
  student_handout_json?: StudentHandoutJson
}

export interface LearningFramework {
  id: number
  uid: string
  branch_id: number | null
  code: string
  name: string
  schema_structure: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LearningModule {
  id: number
  uid: string
  share_token: string
  branch_id: number
  author_id: string
  framework_id: number
  subject_name: string
  grade_level: string
  topic_title: string
  topic_subtitle?: string | null
  language_code: 'id' | 'en'
  duration_minutes: number
  teacher_guide_json: TeacherGuideJson
  student_article_json: StudentArticleJson
  student_lkpd_json: StudentLkpdJson
  report_seed_json: ReportSeedJson
  is_link_shared: boolean
  show_hints_on_web: boolean
  visibility_scope: 'private' | 'branch'
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  deleted_at?: string | null

  // Legacy field support
  student_handout_json?: StudentHandoutJson

  // Joined fields
  author_name?: string
  framework_code?: string
  framework_name?: string
}

export interface LearningModuleSource {
  id: number
  uid: string
  module_id: number
  branch_id: number
  storage_disk: string
  file_path: string
  mime_type: string
  file_size_bytes: number
  extracted_text?: string | null
  created_at: string
}

/**
 * Public Sanitized LMS Module representation for zero-login /learn/{share_token} route.
 * Security Guardrail: Teacher Guide and Answer Keys are completely stripped!
 */
export interface PublicLearnerModule {
  share_token: string
  topic_title: string
  topic_subtitle: string
  subject_name: string
  grade_level: string
  duration_minutes: number
  language_code: 'id' | 'en'
  estimated_read_mins: number
  difficulty_badge: DifficultyBadge
  curriculum_tags: string[]
  student_article_json: StudentArticleJson
  student_lkpd_json: StudentLkpdJson
  show_hints_on_web: boolean
  author_name?: string
  framework_name?: string
  branch_name?: string
  institution_logo?: string
}
