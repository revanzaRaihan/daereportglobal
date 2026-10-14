'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useTranslation } from '@/components/LocaleProvider'
import { APP_CONFIG } from '@/lib/branding'
import Logo from '@/components/Logo'
import { LearningModule } from '@/lib/modules/types'
import { 
  ArrowLeft, 
  Printer, 
  Copy, 
  ArrowRight, 
  Sparkles, 
  Compass, 
  FileText, 
  Target, 
  Lightbulb, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Bookmark,
  Share2
} from 'lucide-react'

export default function ModuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()

  const uid = typeof params.uid === 'string' ? params.uid : Array.isArray(params.uid) ? params.uid[0] : ''

  const [module, setModule] = useState<LearningModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student')
  const [showAnswerKeys, setShowAnswerKeys] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!uid) return
    const fetchModule = async () => {
      try {
        const res = await fetch(`/api/modules/${uid}`)
        const data = await res.json()
        if (data.success && data.data) {
          setModule(data.data)
        } else {
          setToastMsg({ type: 'error', text: data.message || 'Gagal memuat modul.' })
        }
      } catch {
        setToastMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat memuat modul.' })
      } finally {
        setLoading(false)
      }
    }
    fetchModule()
  }, [uid])

  const handlePrint = () => {
    window.print()
  }

  const handleDuplicate = async () => {
    if (!uid) return
    try {
      const res = await fetch(`/api/modules/${uid}`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.data?.uid) {
        setToastMsg({ type: 'success', text: 'Modul berhasil diduplikasi!' })
        router.push(`/studio/modules/${data.data.uid}`)
      } else {
        setToastMsg({ type: 'error', text: data.message })
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Gagal menduplikasi modul.' })
    }
  }

  const handleUseInReport = () => {
    if (!uid) return
    router.push(`/?module=${uid}`)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
        <p className="text-sm">Memuat modul kurikulum...</p>
      </div>
    )
  }

  if (!module) {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-bold">Modul Tidak Ditemukan</h2>
        <p className="text-sm text-text-secondary">Modul pembelajaran mungkin telah dihapus atau Anda tidak memiliki hak akses.</p>
        <Link 
          href="/studio/modules" 
          className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90"
        >
          Kembali ke Studio Modul
        </Link>
      </div>
    )
  }

  const isPublished = module.status === 'published'

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-background text-text-primary print:p-0 print:m-0 print:bg-white print:text-black">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-card text-text-primary print:hidden">
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Action Bar (Hidden during Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-color pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/studio/modules"
            className="p-2 rounded-xl border border-border-color text-text-secondary hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                {module.framework_name || module.framework_code}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isPublished 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
              }`}>
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">{module.topic_title}</h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white font-semibold text-xs hover:opacity-90 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('btn_export_lkpd_pdf') || 'Cetak / Unduh PDF LKPD'}</span>
          </button>

          <button
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-color text-text-primary text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplikasi</span>
          </button>

          <button
            onClick={handleUseInReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:opacity-90 transition shadow-xs cursor-pointer"
          >
            <span>{t('btn_use_in_report') || 'Pakai di Laporan Hari Ini'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Switcher (Hidden during Print) */}
      <div className="flex items-center justify-between border-b border-border-color pb-2 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('student')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'student'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-card border border-border-color text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('tab_student_handout') || 'Lembar Kerja Siswa (LKPD)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('teacher')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'teacher'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-card border border-border-color text-text-secondary hover:text-text-primary'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{t('tab_teacher_guide') || 'Panduan Guru (Lesson Plan)'}</span>
          </button>
        </div>

        {activeTab === 'student' && (
          <button
            onClick={() => setShowAnswerKeys(!showAnswerKeys)}
            className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer font-medium"
          >
            {showAnswerKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showAnswerKeys ? 'Sembunyikan Kunci Jawaban' : 'Tampilkan Kunci Jawaban Guru'}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT HANDOUT / LKPD (PRINTABLE VIEW) */}
      {/* ========================================================================= */}
      {(activeTab === 'student' || typeof window !== 'undefined') && (
        <div className={`p-8 md:p-12 rounded-3xl bg-white text-neutral-900 border border-neutral-300 shadow-sm max-w-4xl mx-auto space-y-6 font-sans print:border-none print:shadow-none print:p-0 print:max-w-none print:block ${activeTab !== 'student' ? 'hidden print:block' : ''}`}>
          
          {/* Branded White-Label Header */}
          <div className="border-b-2 border-neutral-900 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 text-neutral-900 flex items-center justify-center">
                <Logo className="w-10 h-10" />
              </div>
              <div>
                <h2 className="font-black text-2xl tracking-tight text-neutral-900 leading-none mb-1">
                  {APP_CONFIG.name}
                </h2>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                  LEMBAR KERJA PESERTA DIDIK (LKPD)
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-neutral-600 space-y-0.5">
              <div>Mata Pelajaran: <strong className="text-neutral-900">{module.subject_name}</strong></div>
              <div>Tingkat Kelas: <strong className="text-neutral-900">{module.grade_level}</strong></div>
              <div>Durasi Kelas: <strong className="text-neutral-900">{module.duration_minutes} Menit</strong></div>
            </div>
          </div>

          {/* Student Fill-in Blanks */}
          <div className="grid grid-cols-2 gap-6 py-2.5 border-b border-neutral-200 text-xs text-neutral-700">
            <div>
              <span className="font-semibold">Nama Siswa:</span>
              <span className="inline-block border-b border-neutral-400 w-56 ml-2"></span>
            </div>
            <div className="text-right">
              <span className="font-semibold">Tanggal:</span>
              <span className="inline-block border-b border-neutral-400 w-36 ml-2"></span>
            </div>
          </div>

          {/* Handout Title & Summary */}
          <div className="space-y-2">
            <h3 className="font-black text-xl text-neutral-900 tracking-tight">
              {module.student_handout_json?.handout_title || module.topic_title}
            </h3>
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 leading-relaxed">
              <strong className="block text-neutral-900 font-bold mb-1">📌 Ringkasan Konsep Pelajaran:</strong>
              {module.student_handout_json?.concept_summary}
            </div>
          </div>

          {/* Worked Example */}
          {module.student_handout_json?.worked_example && (
            <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-2.5">
              <strong className="text-blue-900 font-bold uppercase tracking-wider block">
                💡 Contoh Soal & Pembahasan Langkah demi Langkah:
              </strong>
              <p className="font-semibold text-neutral-900 text-sm">
                {module.student_handout_json.worked_example.problem}
              </p>
              <div className="space-y-1.5 pl-1">
                {module.student_handout_json.worked_example.step_by_step_solution.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-neutral-800">
                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          <div className="space-y-5 pt-2">
            <strong className="text-xs font-black uppercase tracking-wider text-neutral-900 block border-b border-neutral-200 pb-1">
              📝 Aktivitas & Lembar Latihan Siswa:
            </strong>

            {module.student_handout_json?.worksheet_activities?.map((act) => (
              <div key={act.activity_number} className="p-5 rounded-2xl border border-neutral-300 space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                  <span className="text-sm">
                    Aktivitas #{act.activity_number}: {act.activity_type?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                  {act.instruction}
                </p>

                {/* Answer Workspace Box */}
                <div className="p-4 rounded-xl bg-neutral-50/80 border border-dashed border-neutral-300 text-neutral-400 text-xs min-h-[90px] italic">
                  {act.workspace_prompt || 'Ruang lembar kerja / jawaban murid...'}
                </div>

                {/* Teacher Answer Key Toggle (Automatically hidden when printed unless explicitly kept) */}
                {showAnswerKeys && act.answer_key_for_teacher && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1 print:hidden">
                    <strong className="block text-emerald-800 font-bold">🔑 Kunci Jawaban Guru:</strong>
                    <p className="leading-relaxed">{act.answer_key_for_teacher}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* LKPD Footer */}
          <div className="border-t border-neutral-200 pt-3 flex items-center justify-between text-[10px] text-neutral-400">
            <span>{APP_CONFIG.name} — Pre-Class Learning Engine</span>
            <span>Halaman 1 dari 1</span>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEACHER LESSON PLAN */}
      {/* ========================================================================= */}
      {activeTab === 'teacher' && (
        <div className="space-y-6 max-w-4xl mx-auto print:hidden">
          
          {/* Alignment Card */}
          <div className="p-5 rounded-2xl bg-card border border-border-color space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>Standar Kurikulum: {module.framework_name || module.framework_code}</span>
            </div>
            
            <div className="text-xs space-y-1">
              <strong className="text-text-primary block">Capaian Pembelajaran (CP):</strong>
              <p className="text-text-secondary leading-relaxed bg-background p-3 rounded-xl border border-border-color">
                {module.teacher_guide_json?.timeline_steps ? (module as any).curriculum_alignment?.learning_outcomes_cp || 'Tercapai sesuai standar kurikulum yang dipilih.' : ''}
              </p>
            </div>

            <div className="text-xs space-y-1">
              <strong className="text-text-primary block">Tujuan Pembelajaran (TP):</strong>
              <ul className="list-disc list-inside text-text-secondary space-y-1 pl-1">
                {((module as any).curriculum_alignment?.learning_objectives_tp || []).map((tp: string, idx: number) => (
                  <li key={idx}>{tp}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Hook & Analogy Card */}
          <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" />
              <span>Hook & Analogi Pengantar Materi</span>
            </div>
            <p className="text-sm text-text-primary leading-relaxed bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
              {module.teacher_guide_json?.hook_and_analogy}
            </p>
          </div>

          {/* Timeline Steps */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block">
              Garis Waktu & Langkah Pembelajaran ({module.duration_minutes} Menit)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {module.teacher_guide_json?.timeline_steps?.map((step, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-card border border-border-color space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-border-color pb-2">
                    <span className="text-text-primary">{step.phase}</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-mono text-[10px]">
                      {step.duration_mins}m
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <span className="text-text-secondary font-semibold block text-[11px]">Tindakan Pengajar:</span>
                    <p className="text-text-primary leading-relaxed">{step.instructor_action}</p>
                  </div>
                  <div className="text-xs space-y-1">
                    <span className="text-text-secondary font-semibold block text-[11px]">Aktivitas Siswa:</span>
                    <p className="text-text-primary leading-relaxed">{step.student_activity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Misconceptions & Differentiation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2.5 shadow-2xs">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
                Miskonsepsi Umum Siswa
              </span>
              <ul className="list-disc list-inside text-xs text-text-secondary space-y-1.5">
                {module.teacher_guide_json?.common_misconceptions?.map((misc, idx) => (
                  <li key={idx} className="leading-relaxed">{misc}</li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2.5 shadow-2xs">
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider block">
                Tips Diferensiasi Belajar
              </span>
              <div className="text-xs space-y-1">
                <strong className="text-text-primary block text-[11px]">Untuk Siswa Cepat (Fast Learners):</strong>
                <p className="text-text-secondary leading-relaxed">{module.teacher_guide_json?.differentiation_tips?.fast_learners}</p>
              </div>
              <div className="text-xs space-y-1">
                <strong className="text-text-primary block text-[11px]">Untuk Siswa Membutuhkan Bimbingan:</strong>
                <p className="text-text-secondary leading-relaxed">{module.teacher_guide_json?.differentiation_tips?.struggling_students}</p>
              </div>
            </div>
          </div>

          {/* Daily Report Pre-filled Seed Notice */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Bookmark className="w-4 h-4" />
              <span>Ringkasan Otomatis untuk Laporan Harian (Report Seed):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-text-secondary pt-1">
              <div className="bg-background p-3 rounded-xl border border-border-color">
                <strong className="text-text-primary block mb-0.5">Pilar 1 (Lesson Overview):</strong>
                {module.report_seed_json?.pillar_1_milestone_summary}
              </div>
              <div className="bg-background p-3 rounded-xl border border-border-color">
                <strong className="text-text-primary block mb-0.5">Pilar 3 (Recommended Practice):</strong>
                {module.report_seed_json?.pillar_3_recommended_practice}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Embedded Print Styling */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          header, aside, nav, button, .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 1.5cm;
            size: A4 portrait;
          }
        }
      `}</style>

    </div>
  )
}
