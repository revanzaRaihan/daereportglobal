import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkRateLimit } from '@/lib/rateLimit'
import { generateCurriculumModuleWithAi } from '@/lib/modules/aiModuleGenerator'
import { getFrameworks } from '@/lib/modules/moduleService'
import { getActiveAiConfig } from '@/lib/ai/config'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Akses tidak sah. Silakan login terlebih dahulu.' }, { status: 401 })
    }

    // 2. Strict Rate Limiting: Max 5 generations per 10 minutes per instructor
    const rateLimit = checkRateLimit(`module_gen_${user.id}`, { limit: 5, windowMs: 600_000 })
    if (!rateLimit.success) {
      const retryMinutes = Math.ceil(rateLimit.resetMs / 60000)
      return NextResponse.json(
        {
          success: false,
          message: `Batas kuota AI tercapai (maksimal 5 kali per 10 menit). Silakan tunggu sekitar ${retryMinutes} menit.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining)
          }
        }
      )
    }

    // 3. Parse and validate body
    const body = await request.json()
    const {
      framework_code = 'kurikulum_merdeka',
      subject_name,
      grade_level,
      topic_title,
      custom_notes = '',
      extracted_text = '',
      duration_minutes = 60,
      language_code = 'id'
    } = body

    if (!subject_name || !grade_level || !topic_title) {
      return NextResponse.json(
        { success: false, message: 'Harap lengkapi mata pelajaran, jenjang kelas, dan judul materi pokok.' },
        { status: 422 }
      )
    }

    // 4. Resolve Framework Name
    const frameworks = await getFrameworks()
    const selectedFw = frameworks.find(f => f.code === framework_code)
    const frameworkName = selectedFw?.name || 'Kurikulum Merdeka (CP/TP/ATP)'

    // 5. Fetch Active AI Configuration (prioritizes user settings saved in Option/Settings UI)
    const { provider: activeProvider, apiKey: activeApiKey, model: activeModel } = await getActiveAiConfig(supabase)

    if (!activeApiKey) {
      return NextResponse.json({
        success: false,
        message: 'API Key AI belum dikonfigurasi di Pengaturan atau Environment Server.'
      }, { status: 400 })
    }

    // 6. Style Dataset Sample retrieval
    let styleDatasetSample = ''
    try {
      const { data: styleEntries } = await supabase
        .from('dataset_entries')
        .select('body')
        .eq('language', language_code)
        .limit(2)

      if (styleEntries && styleEntries.length > 0) {
        styleDatasetSample = styleEntries.map(s => s.body).join('\n---\n')
      }
    } catch {
      // Ignore if unavailable
    }

    // 7. Execute AI Generation with XML injection guard
    const generated = await generateCurriculumModuleWithAi({
      frameworkCode: framework_code,
      frameworkName,
      subjectName: String(subject_name),
      gradeLevel: String(grade_level),
      durationMinutes: Number(duration_minutes) || 60,
      languageCode: language_code === 'en' ? 'en' : 'id',
      topicTitle: String(topic_title),
      customNotes: String(custom_notes),
      extractedText: String(extracted_text),
      styleDatasetSample,
      provider: activeProvider,
      apiKey: activeApiKey,
      model: activeModel
    })

    return NextResponse.json({
      success: true,
      data: generated,
      framework_code,
      framework_name: frameworkName,
      subject_name,
      grade_level,
      topic_title,
      duration_minutes,
      language_code
    })

  } catch (error: any) {
    console.error('Module Generator API Error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Terjadi kesalahan sistem saat menghasilkan modul pembelajaran.'
    }, { status: 500 })
  }
}
