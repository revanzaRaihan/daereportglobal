export interface CurriculumAlignment {
  framework_code: string
  learning_outcomes_cp: string
  learning_objectives_tp: string[]
  key_concepts: string[]
}

export interface TimelineStep {
  phase: string
  duration_mins: number
  instructor_action: string
  student_activity: string
}

export interface TeacherGuideJson {
  hook_and_analogy: string
  timeline_steps: TimelineStep[]
  common_misconceptions: string[]
  differentiation_tips: {
    fast_learners: string
    struggling_students: string
  }
}

export interface WorkedExample {
  problem: string
  step_by_step_solution: string[]
}

export type ActivityType = 'guided_practice' | 'problem_solving' | 'creative_challenge'

export interface WorksheetActivity {
  activity_number: number
  activity_type: ActivityType
  instruction: string
  workspace_prompt: string
  answer_key_for_teacher: string
}

export interface StudentHandoutJson {
  handout_title: string
  concept_summary: string
  worked_example: WorkedExample
  worksheet_activities: WorksheetActivity[]
}

export interface ReportSeedJson {
  pillar_1_milestone_summary: string
  pillar_3_recommended_practice: string
}

export interface AiGeneratedModulePayload {
  curriculum_alignment: CurriculumAlignment
  teacher_guide_json: TeacherGuideJson
  student_handout_json: StudentHandoutJson
  report_seed_json: ReportSeedJson
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
  branch_id: number
  author_id: string
  framework_id: number
  subject_name: string
  grade_level: string
  topic_title: string
  language_code: 'id' | 'en'
  duration_minutes: number
  teacher_guide_json: TeacherGuideJson
  student_handout_json: StudentHandoutJson
  report_seed_json: ReportSeedJson
  visibility_scope: 'private' | 'branch'
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  deleted_at?: string | null

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
