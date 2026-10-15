import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fredoka } from 'next/font/google'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { slugify } from '@/lib/slug'
import { APP_CONFIG } from '@/lib/branding'
import ParentDashboard, { ParsedReport } from './ParentDashboard'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-rounded',
  weight: ['400', '500', '600', '700'],
})

interface PageProps {
  params: Promise<{ slug: string }>
}

function parseReportContent(content: string, materi: string) {
  const lines = content.split('\n')
  
  // Find where the separator '-' is
  const separatorIndex = lines.indexOf('-')
  
  // Lesson line is usually line 1 (index 1)
  const lessonLine = lines[1] || ''
  
  // Overview is between line 2 and separator
  let overview = ''
  if (separatorIndex > 2) {
    overview = lines.slice(2, separatorIndex).join('\n').trim()
  } else if (separatorIndex === -1 && lines.length > 2) {
    overview = lines.slice(2, 5).join('\n').trim()
  }

  // After separator, we have the remaining text
  let remainingText = ''
  if (separatorIndex !== -1 && separatorIndex < lines.length - 1) {
    remainingText = lines.slice(separatorIndex + 1).join('\n').trim()
  } else {
    remainingText = content
  }

  // Look for "Training Rec:" (case insensitive)
  const trainingRecMatch = remainingText.match(/Training Rec:/i)
  
  let teachersNote = ''
  let trainingRec = ''
  let parentNote = ''

  if (trainingRecMatch && trainingRecMatch.index !== undefined) {
    teachersNote = remainingText.substring(0, trainingRecMatch.index).trim()
    const afterTrainingRec = remainingText.substring(trainingRecMatch.index).trim()
    
    const paragraphs = afterTrainingRec.split('\n\n')
    if (paragraphs.length >= 2) {
      trainingRec = paragraphs[0].replace(/Training Rec:\s*/i, '').trim()
      parentNote = paragraphs.slice(1).join('\n\n').trim()
    } else {
      trainingRec = afterTrainingRec.replace(/Training Rec:\s*/i, '').trim()
    }
  } else {
    const paragraphs = remainingText.split('\n\n')
    if (paragraphs.length >= 3) {
      teachersNote = paragraphs[0].trim()
      trainingRec = paragraphs[1].trim()
      parentNote = paragraphs.slice(2).join('\n\n').trim()
    } else if (paragraphs.length === 2) {
      teachersNote = paragraphs[0].trim()
      parentNote = paragraphs[1].trim()
    } else {
      teachersNote = remainingText
    }
  }

  // Clean up "Training Rec:" text if present inside the string itself
  trainingRec = trainingRec.replace(/Training Rec:\s*/i, '').trim()

  // Find the completed lesson part
  let lessonCompleted = ''
  const completedMatch = lessonLine.match(/(completed|menyelesaikan)\s+(.*)/i)
  if (completedMatch && completedMatch[2]) {
    lessonCompleted = completedMatch[2].trim()
  } else {
    lessonCompleted = lessonLine || materi
  }

  return {
    lessonCompleted,
    overview: overview || lessonLine,
    teachersNote: teachersNote || 'Tidak ada catatan.',
    trainingRecommendation: trainingRec || 'Tidak ada rekomendasi khusus.',
    parentNote: parentNote || 'Tetap dampingi belajar anak.'
  }
}

async function getStudentAndReports(slug: string) {
  if (!slug || typeof slug !== 'string') return null
  const cleanSlug = slug.trim().toLowerCase()
  if (!cleanSlug) return null

  const supabase = createAdminClient() || (await createClient())

  // 1. Fetch targeted student directly by slug (O(1) Indexed Lookup)
  let { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, subject, meeting_count, user_id, slug')
    .eq('slug', cleanSlug)
    .maybeSingle()

  // 2. Targeted fallback: query at most 1 student by candidate name (O(1) memory & bandwidth)
  if (!student) {
    const candidateName = cleanSlug.replace(/-/g, ' ').trim()
    if (candidateName.length >= 2) {
      const { data: fallbackStudent } = await supabase
        .from('students')
        .select('id, name, subject, meeting_count, user_id, slug')
        .ilike('name', candidateName)
        .limit(1)
        .maybeSingle()

      if (fallbackStudent && (fallbackStudent.slug === cleanSlug || slugify(fallbackStudent.name) === cleanSlug)) {
        student = fallbackStudent
      }
    }
  }

  if (studentError || !student) {
    return null
  }

  // 2. Fetch all reports for this student with resilient fallback
  let reports: any[] = []
  const { data: reportsWithModule, error: reportsWithModuleError } = await supabase
    .from('reports')
    .select('id, meeting_number, report_date, materi, behavior, content, image_url, learning_module_id')
    .eq('student_id', student.id)
    .order('report_date', { ascending: false })
    .order('meeting_number', { ascending: false })

  if (!reportsWithModuleError && reportsWithModule) {
    reports = reportsWithModule
  } else {
    const { data: reportsSimple, error: reportsSimpleError } = await supabase
      .from('reports')
      .select('id, meeting_number, report_date, materi, behavior, content, image_url')
      .eq('student_id', student.id)
      .order('report_date', { ascending: false })
      .order('meeting_number', { ascending: false })

    if (reportsSimpleError || !reportsSimple) {
      return null
    }
    reports = reportsSimple
  }

  // Load report-module fallback mapping from app_settings
  let fallbackLinks: Record<string, number> = {}
  try {
    const { data: linkSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cache_report_module_links')
      .maybeSingle()
    if (linkSetting?.value) {
      fallbackLinks = JSON.parse(linkSetting.value)
    }
  } catch {}

  // Fetch linked modules if any
  const moduleIds = Array.from(new Set((reports || []).map(r => r.learning_module_id || fallbackLinks[r.id]).filter(Boolean)))
  const moduleMap = new Map<number, { share_token: string; topic_title: string; topic_subtitle?: string; duration_minutes: number; is_link_shared: boolean }>()

  if (moduleIds.length > 0) {
    try {
      const { data: moduleData } = await supabase
        .from('learning_modules')
        .select('id, share_token, topic_title, topic_subtitle, duration_minutes, is_link_shared')
        .in('id', moduleIds)
        .eq('is_link_shared', true)
        .is('deleted_at', null)

      if (moduleData) {
        moduleData.forEach(m => moduleMap.set(m.id, m))
      }
    } catch {
      // Table missing or fallback
    }

    if (moduleMap.size === 0) {
      try {
        const { getModules } = await import('@/lib/modules/moduleService')
        const all = await getModules({ userId: '', isAdmin: true })
        all.forEach(m => {
          if (moduleIds.includes(m.id) && m.is_link_shared !== false) {
            moduleMap.set(m.id, {
              share_token: m.share_token,
              topic_title: m.topic_title,
              topic_subtitle: m.topic_subtitle || undefined,
              duration_minutes: m.duration_minutes,
              is_link_shared: m.is_link_shared
            })
          }
        })
      } catch {}
    }
  }

  const parsedReports: ParsedReport[] = (reports || []).map(r => {
    const parsed = parseReportContent(r.content, r.materi)
    const moduleId = r.learning_module_id || fallbackLinks[r.id]
    const linked = moduleId ? moduleMap.get(moduleId) : null
    return {
      id: r.id,
      meeting_number: r.meeting_number,
      report_date: r.report_date,
      materi: r.materi,
      behavior: r.behavior,
      image_url: r.image_url,
      learning_module_id: moduleId || null,
      linked_module: linked || null,
      ...parsed
    }
  })

  return {
    student: {
      id: student.id,
      name: student.name,
      subject: student.subject,
      meeting_count: student.meeting_count,
      user_id: student.user_id
    },
    reports: parsedReports
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await getStudentAndReports(slug)
  
  if (!data) {
    return {
      title: `Murid Tidak Ditemukan | ${APP_CONFIG.name}`,
      description: 'Laporan belajar tidak ditemukan.'
    }
  }

  return {
    title: `Laporan Progres Belajar ${data.student.name} | ${APP_CONFIG.name}`,
    description: `Pantau perkembangan belajar ${data.student.name} untuk program ${data.student.subject} di ${APP_CONFIG.name}.`,
    openGraph: {
      title: `Laporan Progres Belajar ${data.student.name}`,
      description: `Pantau riwayat progres, catatan guru, dan rekomendasi latihan untuk ${data.student.name}.`,
      type: 'website'
    }
  }
}

export default async function ParentPage({ params }: PageProps) {
  const { slug } = await params
  const data = await getStudentAndReports(slug)

  if (!data) {
    notFound()
  }

  return (
    <div className={`${plusJakartaSans.variable} ${fredoka.variable} font-sans`}>
      <ParentDashboard student={data.student} reports={data.reports} />
    </div>
  )
}
