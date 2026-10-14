'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useTranslation } from '@/components/LocaleProvider'
import { APP_CONFIG } from '@/lib/branding'
import { 
  LearningModule, 
  LearningFramework,
  AiGeneratedModulePayload,
  TimelineStep,
  WorksheetActivity
} from '@/lib/modules/types'
import { 
  GraduationCap,
  Sparkles, 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  BookOpen, 
  Copy, 
  Printer, 
  ArrowRight, 
  Check, 
  Clock, 
  Languages, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Edit3, 
  Eye, 
  UploadCloud, 
  CheckCircle2, 
  ChevronRight, 
  Layers, 
  Lightbulb, 
  HelpCircle, 
  Target, 
  Compass, 
  X,
  FileCheck,
  RefreshCw,
  Share2
} from 'lucide-react'

export default function ModuleStudioPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale } = useTranslation()

  // State
  const [modules, setModules] = useState<LearningModule[]>([])
  const [frameworks, setFrameworks] = useState<LearningFramework[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [frameworkFilter, setFrameworkFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [languageFilter, setLanguageFilter] = useState<'all' | 'id' | 'en'>('all')

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 3-Step Wizard Modal States
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [savingModule, setSavingModule] = useState(false)

  // Wizard Step 1: Context Form
  const [wizardFrameworkCode, setWizardFrameworkCode] = useState('kurikulum_merdeka')
  const [wizardSubject, setWizardSubject] = useState('Python Coding')
  const [wizardGradeLevel, setWizardGradeLevel] = useState('Grade 4-6 (9-12 yo)')
  const [wizardDuration, setWizardDuration] = useState(60)
  const [wizardLanguage, setWizardLanguage] = useState<'id' | 'en'>(locale || 'id')

  // Wizard Step 2: Source Input Form
  const [sourceMode, setSourceMode] = useState<'text' | 'upload'>('text')
  const [wizardTopicTitle, setWizardTopicTitle] = useState('')
  const [wizardCustomNotes, setWizardCustomNotes] = useState('')
  const [uploadedSourceText, setUploadedSourceText] = useState('')
  const [uploadingSource, setUploadingSource] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Wizard Step 3: Dual-Tab Editor Form
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher')
  const [showAnswerKeys, setShowAnswerKeys] = useState(true)
  const [generatedPayload, setGeneratedPayload] = useState<AiGeneratedModulePayload | null>(null)
  const [previewUid, setPreviewUid] = useState<string | null>(null)

  // Quick Subject chips
  const SUBJECT_SUGGESTIONS = [
    'Python Coding',
    'Scratch & Game Dev',
    'Robotics & Arduino',
    'Matematika / Logic Math',
    'Science & Engineering',
    'Web Development (HTML/CSS)'
  ]

  // KPI calculations
  const totalModulesCount = modules.length
  const publishedCount = modules.filter(m => m.status === 'published').length
  const uniqueFrameworksCount = new Set(modules.map(m => m.framework_code)).size || frameworks.length
  const estimatedHoursSaved = Math.round(totalModulesCount * 2.5)

  // Fetch initial data
  const loadModules = async () => {
    try {
      const res = await fetch('/api/modules')
      const json = await res.json()
      if (json.success) {
        setModules(json.data || [])
        if (json.frameworks) {
          setFrameworks(json.frameworks)
        }
      }
    } catch (err) {
      console.error('Failed to load modules:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setIsAdmin(user.app_metadata?.role === 'admin')
      }
      await loadModules()
    }
    init()
  }, [supabase])

  // Reset or clear toast after 4s
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMsg])

  // Filter modules
  const filteredModules = modules.filter(m => {
    if (frameworkFilter !== 'all' && m.framework_code !== frameworkFilter) return false
    if (subjectFilter !== 'all' && m.subject_name !== subjectFilter) return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (languageFilter !== 'all' && m.language_code !== languageFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchTopic = m.topic_title.toLowerCase().includes(q)
      const matchSub = m.subject_name.toLowerCase().includes(q)
      const matchGrade = m.grade_level.toLowerCase().includes(q)
      if (!matchTopic && !matchSub && !matchGrade) return false
    }
    return true
  })

  // Get distinct subjects for filter dropdown
  const distinctSubjects = Array.from(new Set(modules.map(m => m.subject_name)))

  // Handle Source Upload with EXIF & Magic Bytes Hardening
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingSource(true)
    setUploadedFileName(file.name)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/modules/upload-source', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setToastMsg({ type: 'error', text: data.message || 'Gagal memproses file materi.' })
        setUploadedFileName('')
      } else {
        setUploadedSourceText(data.extracted_text || '')
        if (data.extracted_text) {
          // If topic is still empty, auto-seed topic from first line
          if (!wizardTopicTitle) {
            const firstLine = data.extracted_text.split('\n')[0].replace(/^[#\s*-]+/, '').trim()
            if (firstLine && firstLine.length < 100) {
              setWizardTopicTitle(firstLine)
            }
          }
        }
        setToastMsg({ type: 'success', text: t('ocr_success') || 'Teks silabus berhasil diekstrak!' })
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Terjadi kesalahan saat mengunggah file.' })
    } finally {
      setUploadingSource(false)
    }
  }

  // Handle AI Generation
  const handleGenerateModule = async () => {
    if (!wizardTopicTitle.trim()) {
      setToastMsg({ type: 'error', text: 'Harap masukkan judul materi pokok terlebih dahulu.' })
      return
    }

    setGeneratingAi(true)
    setToastMsg(null)

    try {
      const res = await fetch('/api/modules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_code: wizardFrameworkCode,
          subject_name: wizardSubject,
          grade_level: wizardGradeLevel,
          duration_minutes: wizardDuration,
          language_code: wizardLanguage,
          topic_title: wizardTopicTitle,
          custom_notes: wizardCustomNotes,
          extracted_text: uploadedSourceText
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setToastMsg({ type: 'error', text: data.message || 'Gagal menghasilkan modul dengan AI.' })
      } else {
        setGeneratedPayload(data.data)
        setWizardStep(3)
        setActiveTab('teacher')
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menghubungi AI Engine.' })
    } finally {
      setGeneratingAi(false)
    }
  }

  // Handle Save Module (Draft or Published)
  const handleSaveModule = async (status: 'draft' | 'published') => {
    if (!generatedPayload) return
    setSavingModule(true)

    const selectedFw = frameworks.find(f => f.code === wizardFrameworkCode)

    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: selectedFw?.id || 1,
          framework_code: wizardFrameworkCode,
          subject_name: wizardSubject,
          grade_level: wizardGradeLevel,
          topic_title: wizardTopicTitle,
          language_code: wizardLanguage,
          duration_minutes: wizardDuration,
          teacher_guide_json: generatedPayload.teacher_guide_json,
          student_handout_json: generatedPayload.student_handout_json,
          report_seed_json: generatedPayload.report_seed_json,
          visibility_scope: 'branch',
          status
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setToastMsg({ type: 'error', text: data.message || 'Gagal menyimpan modul.' })
      } else {
        setToastMsg({ type: 'success', text: data.message })
        setWizardOpen(false)
        resetWizard()
        await loadModules()
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menyimpan modul.' })
    } finally {
      setSavingModule(false)
    }
  }

  // Handle Duplicate & Adapt
  const handleDuplicate = async (uid: string) => {
    try {
      const res = await fetch(`/api/modules/${uid}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setToastMsg({ type: 'success', text: t('btn_duplicate_module') + ' berhasil!' })
        await loadModules()
      } else {
        setToastMsg({ type: 'error', text: data.message })
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Gagal menduplikasi modul.' })
    }
  }

  // Handle Delete
  const handleDelete = async (uid: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus modul pembelajaran ini?')) return
    try {
      const res = await fetch(`/api/modules/${uid}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setToastMsg({ type: 'success', text: 'Modul berhasil dihapus.' })
        await loadModules()
      } else {
        setToastMsg({ type: 'error', text: data.message })
      }
    } catch {
      setToastMsg({ type: 'error', text: 'Gagal menghapus modul.' })
    }
  }

  // 1-Click Integration: Use in Today's Report
  const handleUseInReport = (moduleUid: string) => {
    router.push(`/?module=${moduleUid}`)
  }

  // Open Direct Print / View
  const handleOpenPrintView = (moduleUid: string) => {
    router.push(`/studio/modules/${moduleUid}`)
  }

  const resetWizard = () => {
    setWizardStep(1)
    setWizardTopicTitle('')
    setWizardCustomNotes('')
    setUploadedSourceText('')
    setUploadedFileName('')
    setGeneratedPayload(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-background text-text-primary">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Main Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-color pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {t('modules_title') || 'Studio Modul & LKPD'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/20">
              Pre-Class Engine
            </span>
          </div>
          <p className="text-sm text-text-secondary max-w-2xl">
            {t('modules_subtitle') || 'Rancang Rencana Pembelajaran Guru (Lesson Plan) dan Lembar Kerja Peserta Didik (LKPD) terstandar dalam hitungan detik.'}
          </p>
        </div>

        <button
          onClick={() => {
            resetWizard()
            setWizardOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:opacity-90 active:scale-98 transition shadow-xs cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('btn_create_module') || 'Buat Modul Baru'}</span>
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border-color shadow-2xs">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('kpi_total_modules') || 'Total Modul'}</span>
            <Layers className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-black">{totalModulesCount}</div>
          <p className="text-[11px] text-text-secondary mt-1">Tersimpan di cabang Anda</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border-color shadow-2xs">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('kpi_published_modules') || 'Diterbitkan'}</span>
            <FileCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{publishedCount}</div>
          <p className="text-[11px] text-text-secondary mt-1">Dapat diakses seluruh pengajar</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border-color shadow-2xs">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('kpi_frameworks_count') || 'Kurikulum'}</span>
            <Compass className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{uniqueFrameworksCount}</div>
          <p className="text-[11px] text-text-secondary mt-1">Merdeka, Cambridge, IB, ISTE</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border-color shadow-2xs">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('kpi_hours_saved') || 'Waktu Dihemat'}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">~{estimatedHoursSaved}h</div>
          <p className="text-[11px] text-text-secondary mt-1">Efisiensi administrasi pengajar</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-card border border-border-color shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_modules_placeholder') || 'Cari judul materi, mata pelajaran, atau capaian pembelajaran...'}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-xl text-sm focus:outline-hidden focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Framework Filter */}
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border-color rounded-xl text-xs font-medium focus:outline-hidden focus:border-accent"
          >
            <option value="all">{t('filter_all_frameworks') || 'Semua Kurikulum'}</option>
            <option value="kurikulum_merdeka">Kurikulum Merdeka</option>
            <option value="cambridge">Cambridge</option>
            <option value="ib">International Baccalaureate</option>
            <option value="iste_csta">ISTE & CSTA (Coding)</option>
            <option value="common_core">Common Core (CCSS)</option>
          </select>

          {/* Subject Filter */}
          {distinctSubjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border-color rounded-xl text-xs font-medium focus:outline-hidden focus:border-accent"
            >
              <option value="all">{t('filter_all_subjects') || 'Semua Pelajaran'}</option>
              {distinctSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border-color rounded-xl text-xs font-medium focus:outline-hidden focus:border-accent"
          >
            <option value="all">{t('filter_all_statuses') || 'Semua Status'}</option>
            <option value="published">Diterbitkan</option>
            <option value="draft">Draf</option>
          </select>

          {/* Language Toggle */}
          <div className="flex items-center rounded-xl border border-border-color bg-background p-0.5 text-xs font-medium">
            <button
              onClick={() => setLanguageFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg transition ${languageFilter === 'all' ? 'bg-accent text-white font-bold' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setLanguageFilter('id')}
              className={`px-2.5 py-1.5 rounded-lg transition ${languageFilter === 'id' ? 'bg-accent text-white font-bold' : 'text-text-secondary hover:text-text-primary'}`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguageFilter('en')}
              className={`px-2.5 py-1.5 rounded-lg transition ${languageFilter === 'en' ? 'bg-accent text-white font-bold' : 'text-text-secondary hover:text-text-primary'}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Learning Modules */}
      {loading ? (
        <div className="p-12 text-center text-text-secondary flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
          <p className="text-sm">Memuat modul kurikulum...</p>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border-color flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md">
            <h3 className="font-bold text-base mb-1">Belum Ada Modul Pembelajaran</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Mulai buat modul Rencana Ajar Guru dan Lembar Kerja Siswa (LKPD) pertama Anda menggunakan AI Generator 3 langkah.
            </p>
          </div>
          <button
            onClick={() => {
              resetWizard()
              setWizardOpen(true)
            }}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
          >
            + Buat Modul Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredModules.map((item) => {
            const isOwner = item.author_id === currentUserId
            const isPublished = item.status === 'published'

            // Visual badge colors based on framework
            const badgeColor = 
              item.framework_code === 'kurikulum_merdeka' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
              item.framework_code === 'cambridge' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
              item.framework_code === 'ib' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
              item.framework_code === 'iste_csta' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
              'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'

            return (
              <div 
                key={item.uid}
                className="group p-5 rounded-2xl bg-card border border-border-color shadow-2xs hover:border-accent/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                      {item.framework_name || item.framework_code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isPublished 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    }`}>
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  {/* Topic Title & Subject */}
                  <h3 
                    onClick={() => handleOpenPrintView(item.uid)}
                    className="text-base font-bold tracking-tight mb-1.5 group-hover:text-accent transition cursor-pointer line-clamp-2"
                  >
                    {item.topic_title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary mb-3">
                    <span className="font-semibold text-text-primary">{item.subject_name}</span>
                    <span>•</span>
                    <span>{item.grade_level}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.duration_minutes}m
                    </span>
                    <span>•</span>
                    <span className="uppercase font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800">
                      {item.language_code}
                    </span>
                  </div>

                  {/* Summary Snippet */}
                  <div className="p-3 rounded-xl bg-background border border-border-color text-xs text-text-secondary line-clamp-3 mb-4 leading-relaxed">
                    <span className="font-bold text-text-primary block text-[11px] mb-0.5">Analogi & Hook:</span>
                    {item.teacher_guide_json?.hook_and_analogy || 'Analogi materi untuk mempermudah pemahaman siswa.'}
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="border-t border-border-color pt-3 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {/* View & Print Branded LKPD */}
                    <button
                      onClick={() => handleOpenPrintView(item.uid)}
                      title="Lihat Rencana Ajar & Cetak LKPD Branded"
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Export PDF LKPD direct */}
                    <button
                      onClick={() => handleOpenPrintView(item.uid)}
                      title="Cetak Lembar Kerja Siswa"
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* Duplicate & Adapt */}
                    <button
                      onClick={() => handleDuplicate(item.uid)}
                      title="Duplikasi & Adaptasi Modul"
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete (owner draft or admin) */}
                    {(isAdmin || (isOwner && !isPublished)) && (
                      <button
                        onClick={() => handleDelete(item.uid)}
                        title="Hapus Modul"
                        className="p-2 rounded-lg text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* 1-Click Integration with Today's Report */}
                  <button
                    onClick={() => handleUseInReport(item.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent text-accent hover:text-white transition text-xs font-semibold cursor-pointer"
                  >
                    <span>Pakai di Laporan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3-STEP GENERATOR MODAL / WIZARD */}
      {/* ========================================================================= */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border-color rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border-color flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base md:text-lg tracking-tight">
                    {t('modal_wizard_title') || 'AI Curriculum & LKPD Generator'}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {t('modal_wizard_desc') || 'Pre-Class Engine: Buat Rencana Ajar Guru & Lembar Kerja Siswa dalam 3 langkah.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="px-6 py-3 border-b border-border-color bg-background/50 flex items-center justify-between text-xs font-semibold shrink-0">
              <div 
                onClick={() => setWizardStep(1)}
                className={`flex items-center gap-2 cursor-pointer transition ${wizardStep === 1 ? 'text-accent font-bold' : 'text-text-secondary'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 1 ? 'bg-accent text-white' : 'bg-border-color text-text-secondary'}`}>1</span>
                <span>1. Konteks Kurikulum</span>
              </div>
              <ChevronRight className="w-4 h-4 text-border-color" />
              <div 
                onClick={() => wizardTopicTitle && setWizardStep(2)}
                className={`flex items-center gap-2 cursor-pointer transition ${wizardStep === 2 ? 'text-accent font-bold' : 'text-text-secondary'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 2 ? 'bg-accent text-white' : 'bg-border-color text-text-secondary'}`}>2</span>
                <span>2. Sumber & Materi</span>
              </div>
              <ChevronRight className="w-4 h-4 text-border-color" />
              <div 
                className={`flex items-center gap-2 transition ${wizardStep === 3 ? 'text-accent font-bold' : 'text-text-secondary'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === 3 ? 'bg-accent text-white' : 'bg-border-color text-text-secondary'}`}>3</span>
                <span>3. Editor & Pratinjau</span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* STEP 1: CONTEXT */}
              {wizardStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Select Curriculum Framework Cards */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2.5">
                      {t('label_framework') || 'Pilih Standar Kurikulum'}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {[
                        {
                          code: 'kurikulum_merdeka',
                          name: 'Kurikulum Merdeka (CP/TP/ATP)',
                          desc: 'Capaian & Tujuan Pembelajaran esensial Indonesia + Profil Pelajar Pancasila.'
                        },
                        {
                          code: 'cambridge',
                          name: 'Cambridge International',
                          desc: 'Inquiry-led learning objectives, success criteria, and progression stages.'
                        },
                        {
                          code: 'ib',
                          name: 'International Baccalaureate (IB)',
                          desc: 'Inquiry statements, learner profiles, and transdisciplinary conceptual exploration.'
                        },
                        {
                          code: 'iste_csta',
                          name: 'ISTE & CSTA (Computer Science)',
                          desc: 'Computational thinking, algorithmic decomposition, and hands-on coding milestones.'
                        },
                        {
                          code: 'common_core',
                          name: 'Common Core (CCSS)',
                          desc: 'US standardized domain clusters and rigorous performance standards.'
                        }
                      ].map((fw) => (
                        <div
                          key={fw.code}
                          onClick={() => setWizardFrameworkCode(fw.code)}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                            wizardFrameworkCode === fw.code 
                              ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                              : 'border-border-color hover:border-text-secondary/40 bg-card'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">{fw.name}</span>
                            {wizardFrameworkCode === fw.code && <Check className="w-4 h-4 text-accent shrink-0" />}
                          </div>
                          <p className="text-[11px] text-text-secondary leading-snug">{fw.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subject and Grade Level */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary mb-1.5">
                        {t('label_subject') || 'Mata Pelajaran'}
                      </label>
                      <input
                        type="text"
                        value={wizardSubject}
                        onChange={(e) => setWizardSubject(e.target.value)}
                        placeholder="Contoh: Python Coding"
                        className="w-full px-3.5 py-2.5 bg-background border border-border-color rounded-xl text-sm font-medium focus:outline-hidden focus:border-accent"
                      />
                      {/* Suggestion tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {SUBJECT_SUGGESTIONS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setWizardSubject(s)}
                            className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-secondary mb-1.5">
                        {t('label_grade_level') || 'Jenjang / Usia Siswa'}
                      </label>
                      <input
                        type="text"
                        value={wizardGradeLevel}
                        onChange={(e) => setWizardGradeLevel(e.target.value)}
                        placeholder="Contoh: Grade 4-6, Usia 9-12 tahun"
                        className="w-full px-3.5 py-2.5 bg-background border border-border-color rounded-xl text-sm font-medium focus:outline-hidden focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Duration and Language */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary mb-1.5">
                        {t('label_duration') || 'Target Durasi Sesi (Menit)'}
                      </label>
                      <div className="flex items-center gap-2">
                        {[45, 60, 90, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setWizardDuration(mins)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                              wizardDuration === mins 
                                ? 'bg-accent text-white border-accent' 
                                : 'bg-background border-border-color text-text-secondary hover:border-text-secondary'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-secondary mb-1.5">
                        {t('label_output_language') || 'Bahasa Output'}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardLanguage('id')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            wizardLanguage === 'id' 
                              ? 'bg-accent text-white border-accent' 
                              : 'bg-background border-border-color text-text-secondary hover:border-text-secondary'
                          }`}
                        >
                          Bahasa Indonesia (ID)
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardLanguage('en')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            wizardLanguage === 'en' 
                              ? 'bg-accent text-white border-accent' 
                              : 'bg-background border-border-color text-text-secondary hover:border-text-secondary'
                          }`}
                        >
                          English (EN)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SOURCE INPUT */}
              {wizardStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Mode Selector */}
                  <div className="flex items-center rounded-xl p-1 bg-background border border-border-color text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSourceMode('text')}
                      className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                        sourceMode === 'text' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t('tab_source_text') || 'Ketik Topik & Catatan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('upload')}
                      className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                        sourceMode === 'upload' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t('tab_source_upload') || 'Unggah Buku / Silabus (PDF/Foto)'}
                    </button>
                  </div>

                  {/* Mode A: Direct Topic and Notes */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {t('label_topic_title') || 'Judul Materi Pokok'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={wizardTopicTitle}
                      onChange={(e) => setWizardTopicTitle(e.target.value)}
                      placeholder={t('placeholder_topic_title') || 'Contoh: Pengenalan Perulangan (Loops & Iteration) dalam Python'}
                      className="w-full px-3.5 py-2.5 bg-background border border-border-color rounded-xl text-sm font-medium focus:outline-hidden focus:border-accent"
                    />
                  </div>

                  {/* Mode B: Upload Textbook Page / Syllabus */}
                  {sourceMode === 'upload' && (
                    <div className="space-y-3">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-6 rounded-2xl border-2 border-dashed border-border-color hover:border-accent bg-background/50 hover:bg-accent/5 transition flex flex-col items-center justify-center text-center cursor-pointer"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <UploadCloud className="w-8 h-8 text-accent mb-2" />
                        <h4 className="font-bold text-xs mb-1">
                          {t('upload_dropzone_title') || 'Tarik & Lepas File Buku / Silabus di Sini'}
                        </h4>
                        <p className="text-[11px] text-text-secondary max-w-sm">
                          {t('upload_dropzone_hint') || 'Mendukung PDF, JPEG, PNG, WebP (Maks. 10MB). Dilengkapi OCR otomatis & pembersihan EXIF.'}
                        </p>
                      </div>

                      {uploadingSource && (
                        <div className="flex items-center gap-2 text-xs text-accent">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('ocr_extracting') || 'Mengekstrak teks materi dari dokumen...'}</span>
                        </div>
                      )}

                      {uploadedFileName && !uploadingSource && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                          <span className="font-semibold truncate">📄 {uploadedFileName}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">OCR Siap</span>
                        </div>
                      )}

                      {uploadedSourceText && (
                        <div>
                          <label className="block text-xs font-bold text-text-secondary mb-1">
                            Hasil Ekstraksi Teks (Dapat disunting):
                          </label>
                          <textarea
                            rows={4}
                            value={uploadedSourceText}
                            onChange={(e) => setUploadedSourceText(e.target.value)}
                            className="w-full p-3 bg-background border border-border-color rounded-xl text-xs font-mono leading-relaxed focus:outline-hidden focus:border-accent"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Optional Custom Notes */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      {t('label_custom_notes') || 'Poin Kunci / Catatan Pedagogis Tambahan (Opsional)'}
                    </label>
                    <textarea
                      rows={3}
                      value={wizardCustomNotes}
                      onChange={(e) => setWizardCustomNotes(e.target.value)}
                      placeholder={t('placeholder_custom_notes') || 'Ketik konsep khusus yang ingin ditekankan, contoh kode, atau analogi favorit Anda...'}
                      className="w-full p-3 bg-background border border-border-color rounded-xl text-xs focus:outline-hidden focus:border-accent"
                    />
                  </div>

                  {/* Institutional Tone Indicator */}
                  <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 flex items-center gap-2.5 text-xs text-text-secondary">
                    <Sparkles className="w-4 h-4 text-accent shrink-0" />
                    <span>
                      Gaya bahasa institusi (<strong className="text-text-primary">Style Dataset</strong>) secara otomatis diselaraskan untuk modul dan lembar kerja ini.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: DUAL-TAB EDITOR & PREVIEW */}
              {wizardStep === 3 && generatedPayload && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Tab Navigation & Teacher Key Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-color pb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('teacher')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          activeTab === 'teacher' 
                            ? 'bg-accent text-white shadow-xs' 
                            : 'bg-background border border-border-color text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>{t('tab_teacher_guide') || 'Panduan Guru (Lesson Plan)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('student')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          activeTab === 'student' 
                            ? 'bg-accent text-white shadow-xs' 
                            : 'bg-background border border-border-color text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t('tab_student_handout') || 'Lembar Kerja Siswa (LKPD)'}</span>
                      </button>
                    </div>

                    {activeTab === 'student' && (
                      <button
                        type="button"
                        onClick={() => setShowAnswerKeys(!showAnswerKeys)}
                        className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{showAnswerKeys ? 'Sembunyikan Kunci Jawaban' : 'Tampilkan Kunci Jawaban'}</span>
                      </button>
                    )}
                  </div>

                  {/* TAB A: TEACHER LESSON PLAN */}
                  {activeTab === 'teacher' && (
                    <div className="space-y-4">
                      {/* Alignment */}
                      <div className="p-4 rounded-2xl bg-background border border-border-color space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
                          <Target className="w-4 h-4" />
                          <span>Penyelarasan Kurikulum ({generatedPayload.curriculum_alignment.framework_code})</span>
                        </div>
                        <div className="text-xs">
                          <strong className="text-text-primary block mb-0.5">Capaian Pembelajaran (CP / Learning Outcomes):</strong>
                          <p className="text-text-secondary leading-relaxed">{generatedPayload.curriculum_alignment.learning_outcomes_cp}</p>
                        </div>
                        <div className="text-xs">
                          <strong className="text-text-primary block mb-0.5">Tujuan Pembelajaran (TP):</strong>
                          <ul className="list-disc list-inside text-text-secondary space-y-0.5">
                            {generatedPayload.curriculum_alignment.learning_objectives_tp.map((tp, idx) => (
                              <li key={idx}>{tp}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Hook & Analogy */}
                      <div className="p-4 rounded-2xl bg-background border border-border-color space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                          <Lightbulb className="w-4 h-4" />
                          <span>Hook & Analogi Dunia Nyata</span>
                        </div>
                        <textarea
                          rows={2}
                          value={generatedPayload.teacher_guide_json.hook_and_analogy}
                          onChange={(e) => {
                            const val = e.target.value
                            setGeneratedPayload({
                              ...generatedPayload,
                              teacher_guide_json: {
                                ...generatedPayload.teacher_guide_json,
                                hook_and_analogy: val
                              }
                            })
                          }}
                          className="w-full p-2.5 bg-card border border-border-color rounded-xl text-xs leading-relaxed focus:outline-hidden focus:border-accent"
                        />
                      </div>

                      {/* Timeline Steps */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block">
                          Garis Waktu & Langkah Pembelajaran ({wizardDuration} Menit)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {generatedPayload.teacher_guide_json.timeline_steps.map((step, idx) => (
                            <div key={idx} className="p-3.5 rounded-2xl bg-background border border-border-color space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-text-primary">{step.phase}</span>
                                <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono text-[10px]">
                                  {step.duration_mins}m
                                </span>
                              </div>
                              <div className="text-[11px] space-y-1">
                                <span className="text-text-secondary font-semibold block">Tindakan Guru:</span>
                                <p className="text-text-primary">{step.instructor_action}</p>
                              </div>
                              <div className="text-[11px] space-y-1">
                                <span className="text-text-secondary font-semibold block">Aktivitas Siswa:</span>
                                <p className="text-text-primary">{step.student_activity}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Common Misconceptions & Differentiation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-background border border-border-color space-y-2">
                          <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
                            Miskonsepsi Umum Siswa
                          </span>
                          <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                            {generatedPayload.teacher_guide_json.common_misconceptions.map((misc, idx) => (
                              <li key={idx}>{misc}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-2xl bg-background border border-border-color space-y-2">
                          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider block">
                            Tips Diferensiasi Belajar
                          </span>
                          <div className="text-xs space-y-1">
                            <strong className="text-text-primary block text-[11px]">Siswa Cepat (Fast Learners):</strong>
                            <p className="text-text-secondary">{generatedPayload.teacher_guide_json.differentiation_tips.fast_learners}</p>
                          </div>
                          <div className="text-xs space-y-1">
                            <strong className="text-text-primary block text-[11px]">Siswa Butuh Bimbingan:</strong>
                            <p className="text-text-secondary">{generatedPayload.teacher_guide_json.differentiation_tips.struggling_students}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB B: STUDENT HANDOUT / LKPD */}
                  {activeTab === 'student' && (
                    <div className="p-6 rounded-2xl bg-white text-neutral-900 border border-neutral-300 shadow-sm space-y-5 font-sans">
                      
                      {/* Branded White-Label Header */}
                      <div className="border-b-2 border-neutral-800 pb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-xl tracking-tight text-neutral-900">{APP_CONFIG.name}</h3>
                          <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">
                            LEMBAR KERJA PESERTA DIDIK (LKPD)
                          </p>
                        </div>
                        <div className="text-right text-xs text-neutral-600 space-y-0.5">
                          <div>Mata Pelajaran: <strong>{wizardSubject}</strong></div>
                          <div>Jenjang: <strong>{wizardGradeLevel}</strong></div>
                        </div>
                      </div>

                      {/* Student Details fill-in blank */}
                      <div className="grid grid-cols-2 gap-4 py-2 border-b border-neutral-200 text-xs">
                        <div>Nama Siswa: <span className="inline-block border-b border-neutral-400 w-48"></span></div>
                        <div className="text-right">Tanggal: <span className="inline-block border-b border-neutral-400 w-32"></span></div>
                      </div>

                      {/* Handout Title & Summary */}
                      <div>
                        <h4 className="font-extrabold text-lg text-neutral-900 mb-1">
                          {generatedPayload.student_handout_json.handout_title || wizardTopicTitle}
                        </h4>
                        <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                          {generatedPayload.student_handout_json.concept_summary}
                        </p>
                      </div>

                      {/* Worked Example */}
                      {generatedPayload.student_handout_json.worked_example && (
                        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
                          <strong className="text-blue-900 font-bold uppercase tracking-wider block">
                            💡 Contoh Soal & Pembahasan Langkah demi Langkah:
                          </strong>
                          <p className="font-semibold text-neutral-800">{generatedPayload.student_handout_json.worked_example.problem}</p>
                          <ol className="list-decimal list-inside text-neutral-700 space-y-1">
                            {generatedPayload.student_handout_json.worked_example.step_by_step_solution.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Activities */}
                      <div className="space-y-4">
                        <strong className="text-xs font-black uppercase tracking-wider text-neutral-800 block">
                          📝 Aktivitas & Lembar Latihan:
                        </strong>
                        {generatedPayload.student_handout_json.worksheet_activities.map((act) => (
                          <div key={act.activity_number} className="p-4 rounded-xl border border-neutral-200 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                              <span>Aktivitas #{act.activity_number}: {act.activity_type.replace('_', ' ').toUpperCase()}</span>
                            </div>
                            <p className="text-xs text-neutral-700">{act.instruction}</p>
                            
                            {/* Student Answer Space */}
                            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-400 text-xs min-h-[70px] italic">
                              {act.workspace_prompt || 'Ruang jawaban / catatan pengerjaan murid di sini...'}
                            </div>

                            {/* Teacher Answer Key Toggle */}
                            {showAnswerKeys && act.answer_key_for_teacher && (
                              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] space-y-0.5">
                                <strong>🔑 Kunci Jawaban Guru:</strong>
                                <p>{act.answer_key_for_teacher}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 border-t border-border-color bg-card flex items-center justify-between shrink-0">
              {wizardStep > 1 && (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary border border-border-color transition cursor-pointer"
                >
                  Kembali
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {wizardStep === 1 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{t('btn_next_step') || 'Lanjutkan ke Input Materi'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {wizardStep === 2 && (
                  <button
                    type="button"
                    disabled={generatingAi || !wizardTopicTitle.trim()}
                    onClick={handleGenerateModule}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {generatingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('btn_generating_module') || 'Merancang Modul AI...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{t('btn_generate_module_ai') || 'Generate Modul & LKPD AI'}</span>
                      </>
                    )}
                  </button>
                )}

                {wizardStep === 3 && (
                  <>
                    <button
                      type="button"
                      disabled={savingModule}
                      onClick={() => handleSaveModule('draft')}
                      className="px-4 py-2.5 rounded-xl border border-border-color text-text-primary text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                    >
                      {t('btn_save_draft') || 'Simpan Draf'}
                    </button>

                    <button
                      type="button"
                      disabled={savingModule}
                      onClick={() => handleSaveModule('published')}
                      className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {savingModule ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          <span>{t('btn_publish_module') || 'Terbitkan ke Cabang'}</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
