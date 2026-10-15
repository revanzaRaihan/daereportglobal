import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUserAdmin } from '@/lib/instructorAuth'
import { getModules, createModule, getFrameworks } from '@/lib/modules/moduleService'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject') || undefined
    const gradeLevel = searchParams.get('grade_level') || undefined
    const frameworkCode = searchParams.get('framework_code') || undefined
    const languageCode = (searchParams.get('language_code') as 'id' | 'en') || undefined
    const status = (searchParams.get('status') as any) || undefined
    const search = searchParams.get('search') || undefined

    const isAdmin = isUserAdmin(user)
    const modules = await getModules({
      branchId: 1,
      userId: user.id,
      isAdmin,
      subject,
      gradeLevel,
      frameworkCode,
      languageCode,
      status,
      search
    })

    const frameworks = await getFrameworks()

    return NextResponse.json({
      success: true,
      data: modules,
      frameworks
    })
  } catch (error: any) {
    console.error('List Modules API Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      framework_id,
      framework_code,
      subject_name,
      grade_level,
      topic_title,
      topic_subtitle,
      language_code = 'id',
      duration_minutes = 60,
      teacher_guide_json,
      student_article_json,
      student_lkpd_json,
      student_handout_json,
      report_seed_json,
      is_link_shared = true,
      show_hints_on_web = true,
      visibility_scope = 'branch',
      status = 'draft'
    } = body

    if (!subject_name || !grade_level || !topic_title || !teacher_guide_json) {
      return NextResponse.json({
        success: false,
        message: 'Data modul tidak lengkap. Harap isi semua komponen materi.'
      }, { status: 422 })
    }

    // Resolve framework_id if only framework_code is passed
    let resolvedFrameworkId = Number(framework_id)
    if (!resolvedFrameworkId || isNaN(resolvedFrameworkId)) {
      const frameworks = await getFrameworks()
      const match = frameworks.find(f => f.code === framework_code)
      resolvedFrameworkId = match ? match.id : 1
    }

    const module = await createModule({
      branchId: 1,
      authorId: user.id,
      frameworkId: resolvedFrameworkId,
      frameworkCode: framework_code,
      subjectName: String(subject_name),
      gradeLevel: String(grade_level),
      topicTitle: String(topic_title),
      topicSubtitle: topic_subtitle ? String(topic_subtitle) : undefined,
      languageCode: language_code === 'en' ? 'en' : 'id',
      durationMinutes: Number(duration_minutes) || 60,
      teacherGuideJson: teacher_guide_json,
      studentArticleJson: student_article_json,
      studentLkpdJson: student_lkpd_json,
      studentHandoutJson: student_handout_json,
      reportSeedJson: report_seed_json || {
        pillar_1_milestone_summary: `Mempelajari topik ${topic_title} pada materi ${subject_name}.`,
        pillar_3_recommended_practice: `Latihan mandiri pemecahan masalah materi ${topic_title}.`
      },
      isLinkShared: Boolean(is_link_shared),
      showHintsOnWeb: Boolean(show_hints_on_web),
      visibilityScope: visibility_scope === 'private' ? 'private' : 'branch',
      status: status === 'published' ? 'published' : 'draft'
    })

    return NextResponse.json({
      success: true,
      data: module,
      message: status === 'published' 
        ? 'Modul pembelajaran berhasil diterbitkan ke cabang.' 
        : 'Modul pembelajaran berhasil disimpan sebagai draf.'
    })
  } catch (error: any) {
    console.error('Create Module API Error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
