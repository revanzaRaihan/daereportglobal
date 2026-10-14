import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { buildAiPrompt } from '@/lib/ai/promptBuilder'
import { classifyCategory, generateReportSections, assembleReport, ReportSections } from '@/lib/ai/generator'
import { checkRateLimit } from '@/lib/rateLimit'
import { STARTER_STYLES, STARTER_RECOMMENDATIONS } from '@/lib/starterDatasets'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized access.' }, { status: 401 })
    }

    // 2. Rate limiting check (max 10 requests per user per minute)
    const rateLimit = checkRateLimit(`ai_gen_${user.id}`, { limit: 10, windowMs: 60_000 })
    if (!rateLimit.success) {
      const retrySeconds = Math.ceil(rateLimit.resetMs / 1000)
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak permintaan pembuatan laporan. Silakan tunggu ${retrySeconds} detik sebelum mencoba lagi.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retrySeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining)
          }
        }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const {
      student_id,
      meeting_number,
      report_date,
      materi = '',
      behavior,
      language = 'id',
      report_type = 'full',
      module_context
    } = body

    if (!student_id || !meeting_number || !report_date || !behavior) {
      return NextResponse.json({ success: false, message: 'Missing required parameters.' }, { status: 422 })
    }

    // Input length validation (anti-bloat & anti prompt injection guard)
    const trimmedBehavior = String(behavior).trim()
    if (trimmedBehavior.length < 5) {
      return NextResponse.json({
        success: false,
        message: 'Deskripsi observasi siswa terlalu singkat (minimal 5 karakter).'
      }, { status: 422 })
    }

    if (trimmedBehavior.length > 2500) {
      return NextResponse.json({
        success: false,
        message: 'Deskripsi observasi siswa melebihi batas maksimal 2.500 karakter.'
      }, { status: 422 })
    }

    if (String(materi).length > 500) {
      return NextResponse.json({
        success: false,
        message: 'Deskripsi materi melebihi batas maksimal 500 karakter.'
      }, { status: 422 })
    }

    // 4. Fetch student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', student_id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ success: false, message: 'Student not found.' }, { status: 404 })
    }

    // Determine target language: request parameter prioritized, with student.language fallback
    const targetLanguage = (language === 'en' || language === 'id') 
      ? language 
      : ((student.language === 'en' || student.language === 'id') ? student.language : 'id')

    // 5. Fetch settings
    // Secure retrieval: First priority is server environment variables (AI_API_KEY).
    // If not in env, fetch from app_settings via server-side admin client (bypassing RLS).
    let provider = process.env.AI_PROVIDER
    let apiKey = process.env.AI_API_KEY
    let model = process.env.AI_MODEL

    if (!apiKey) {
      const adminClient = createAdminClient()
      const dbClient = adminClient || supabase
      const { data: settingsData } = await dbClient.from('app_settings').select('key, value')
      const settings = new Map(settingsData?.map(s => [s.key, s.value]) || [])

      provider = provider || settings.get('ai_provider') || 'gemini'
      apiKey = settings.get('ai_api_key') || undefined
      model = model || settings.get('ai_model') || (provider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')
    } else {
      provider = provider || 'gemini'
      model = model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: 'API Key AI belum dikonfigurasi di Pengaturan atau Environment Server.'
      }, { status: 400 })
    }

    const activeProvider: string = provider || 'gemini'
    const activeApiKey: string = apiKey
    const activeModel: string = model || (activeProvider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')

    // 5. Check if at least one dataset entry exists for the selected language
    let { count, error: countError } = await supabase
      .from('dataset_entries')
      .select('*', { count: 'exact', head: true })
      .eq('language', targetLanguage)

    if (countError || count === null || count === 0) {
      // Auto-seed starter datasets for smooth demo experience
      try {
        const stylesToInsert = STARTER_STYLES.map(s => ({
          ...s,
          user_id: user.id
        }))
        await supabase.from('dataset_entries').insert(stylesToInsert)

        const recsToInsert = STARTER_RECOMMENDATIONS.map(r => ({
          ...r,
          user_id: user.id
        }))
        await supabase.from('recommendation_datasets').insert(recsToInsert)
      } catch (seedErr) {
        console.error('Failed to auto-seed starter datasets in generate-report:', seedErr)
      }
    }

    // 6. Classify Student Behavior
    const category = await classifyCategory(behavior, materi, activeProvider, activeApiKey, activeModel)

    // 7. Generate report sections with retries (max 2 attempts)
    const maxAttempts = 2
    let attempt = 0
    let reportSections: ReportSections | null = null
    let lastError: string | null = null

    while (attempt < maxAttempts) {
      attempt++
      try {
        const prompt = await buildAiPrompt({
          supabase,
          student,
          meetingNo: meeting_number,
          dateVal: report_date,
          materi,
          behavior,
          category,
          language: targetLanguage,
          moduleContext: module_context
        })

        reportSections = await generateReportSections(prompt, activeProvider, activeApiKey, activeModel)

        // Validate structure and basic length constraints
        if (
          reportSections &&
          reportSections.overview &&
          reportSections.overview.length >= 30 &&
          reportSections.teachersNote &&
          reportSections.teachersNote.length >= 15 &&
          reportSections.trainingRecommendation &&
          reportSections.trainingRecommendation.length >= 15 &&
          reportSections.parentNote &&
          reportSections.parentNote.length >= 15 &&
          reportSections.lessonCompleted &&
          reportSections.lessonCompleted.length >= 3
        ) {
          break // Success
        }
        
        lastError = `Hasil generate terlalu pendek pada percobaan ke-${attempt}.`
      } catch (e: any) {
        lastError = e.message || 'Error generating report sections'
      }
    }

    if (!reportSections) {
      return NextResponse.json({
        success: false,
        message: `Gagal menghasilkan laporan terstruktur: ${lastError || 'Alasan tidak diketahui'}`
      }, { status: 500 })
    }

    // 8. Assemble sections
    const outputText = assembleReport(student, meeting_number, report_date, reportSections, targetLanguage, report_type)

    // Warning flag if validation parameters were not fully met on final try
    let warning: string | null = null
    const isStillShort = reportSections.overview.length < 30 ||
                         reportSections.teachersNote.length < 15 ||
                         reportSections.trainingRecommendation.length < 15 ||
                         reportSections.parentNote.length < 15 ||
                         reportSections.lessonCompleted.length < 3
                         
    if (isStillShort) {
      warning = 'Hasil generate laporan terindikasi terlalu pendek. Silakan periksa kembali hasil generate.'
    }

    return NextResponse.json({
      success: true,
      text: outputText,
      warning,
      student_id: student.id,
      student_name: student.name,
      subject: student.subject,
      meeting_number,
      report_date,
      materi,
      behavior
    })

  } catch (error: any) {
    console.error('AI Generation API Exception:', error)
    return NextResponse.json({
      success: false,
      message: 'Maaf, terjadi kesalahan sistem saat memproses laporan dengan AI. Silakan coba kembali.'
    }, { status: 500 })
  }
}
