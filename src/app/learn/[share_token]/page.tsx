import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getPublicModuleByShareToken } from '@/lib/modules/moduleService'
import { APP_CONFIG } from '@/lib/branding'
import LmsArticleReader from './LmsArticleReader'

interface PageProps {
  params: Promise<{ share_token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { share_token } = await params
  const module = await getPublicModuleByShareToken(share_token)

  if (!module) {
    return {
      title: `Modul Pembelajaran Tidak Ditemukan | ${APP_CONFIG.name}`,
      description: 'Tautan modul pembelajaran tidak ditemukan atau telah dinonaktifkan.'
    }
  }

  const cleanTitle = `${module.topic_title} - Modul Belajar & LKPD | ${module.branch_name || APP_CONFIG.name}`
  const description = module.topic_subtitle || `Pelajari materi ${module.topic_title} untuk ${module.grade_level} (${module.subject_name}) dengan modul interaktif dan tantangan LKPD.`

  return {
    title: cleanTitle,
    description,
    openGraph: {
      title: cleanTitle,
      description,
      type: 'article',
      siteName: module.branch_name || APP_CONFIG.name
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle,
      description
    }
  }
}

export default async function PublicLearnPage({ params }: PageProps) {
  const { share_token } = await params
  const module = await getPublicModuleByShareToken(share_token)

  if (!module) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-[#DDD9CD] shadow-lg space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto text-2xl font-bold font-mono">
            📚
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-neutral-900 font-editorial-headline">
              Modul Tidak Tersedia
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Tautan lembar kerja ini tidak valid, telah kedaluwarsa, atau akses publik telah dinonaktifkan oleh pengajar Anda.
            </p>
          </div>
          <p className="text-[11px] font-mono text-neutral-400">
            {APP_CONFIG.name} • Hubungi pengajar kelas Anda untuk mendapatkan tautan terbaru.
          </p>
        </div>
      </div>
    )
  }

  return <LmsArticleReader module={module} />
}
