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
  Share2,
  ExternalLink,
  RotateCcw,
  MessageCircle,
  Check,
  Zap,
  Flame,
  Award
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
  const [printMode, setPrintMode] = useState<'student' | 'teacher'>('student')
  const [showAnswerKeys, setShowAnswerKeys] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Share link modal / controls state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isLinkShared, setIsLinkShared] = useState(true)
  const [showHintsOnWeb, setShowHintsOnWeb] = useState(true)
  const [shareToken, setShareToken] = useState('')
  const [rotatingToken, setRotatingToken] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const triggerToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 3500)
  }

  const fetchModule = async () => {
    try {
      const res = await fetch(`/api/modules/${uid}`)
      const data = await res.json()
      if (data.success && data.data) {
        setModule(data.data)
        setIsLinkShared(data.data.is_link_shared !== false)
        setShowHintsOnWeb(data.data.show_hints_on_web !== false)
        setShareToken(data.data.share_token || '')
      } else {
        triggerToast('error', data.message || 'Gagal memuat modul.')
      }
    } catch {
      triggerToast('error', 'Terjadi kesalahan sistem saat memuat modul.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (uid) fetchModule()
  }, [uid])

  const handlePrint = (mode: 'student' | 'teacher') => {
    setPrintMode(mode)
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const handleDuplicate = async () => {
    if (!uid) return
    try {
      const res = await fetch(`/api/modules/${uid}`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.data?.uid) {
        triggerToast('success', 'Modul berhasil diduplikasi!')
        router.push(`/studio/modules/${data.data.uid}`)
      } else {
        triggerToast('error', data.message)
      }
    } catch {
      triggerToast('error', 'Gagal menduplikasi modul.')
    }
  }

  const handleUseInReport = () => {
    if (!uid) return
    router.push(`/?module=${uid}`)
  }

  const handleToggleShare = async (newVal: boolean) => {
    setIsLinkShared(newVal)
    try {
      const res = await fetch(`/api/modules/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_link_shared: newVal })
      })
      const data = await res.json()
      if (data.success) {
        triggerToast('success', newVal ? 'Tautan publik modul diaktifkan.' : 'Tautan publik modul dinonaktifkan.')
      } else {
        setIsLinkShared(!newVal)
        triggerToast('error', data.message)
      }
    } catch {
      setIsLinkShared(!newVal)
      triggerToast('error', 'Gagal memperbarui status tautan.')
    }
  }

  const handleToggleHints = async (newVal: boolean) => {
    setShowHintsOnWeb(newVal)
    try {
      const res = await fetch(`/api/modules/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_hints_on_web: newVal })
      })
      const data = await res.json()
      if (data.success) {
        triggerToast('success', newVal ? 'Petunjuk interaktif di web diaktifkan.' : 'Petunjuk interaktif di web disembunyikan.')
      } else {
        setShowHintsOnWeb(!newVal)
        triggerToast('error', data.message)
      }
    } catch {
      setShowHintsOnWeb(!newVal)
      triggerToast('error', 'Gagal memperbarui pengaturan petunjuk.')
    }
  }

  const handleRotateToken = async () => {
    if (!confirm('Apakah Anda yakin ingin membuat ulang token tautan? Link publik lama akan langsung kedaluwarsa dan tidak dapat diakses lagi.')) {
      return
    }
    setRotatingToken(true)
    try {
      const res = await fetch(`/api/modules/${uid}/rotate-token`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.share_token) {
        setShareToken(data.share_token)
        triggerToast('success', 'Token link berhasil dirotasi!')
      } else {
        triggerToast('error', data.message)
      }
    } catch {
      triggerToast('error', 'Gagal membuat ulang token link.')
    } finally {
      setRotatingToken(false)
    }
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/learn/${shareToken}` : `/learn/${shareToken}`

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      triggerToast('success', 'Tautan siswa berhasil disalin!')
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleShareWhatsApp = () => {
    if (!module) return
    const msg = `📚 *Materi & Lembar Kerja Siswa (LKPD)*\n📌 *Topik:* ${module.topic_title}\n🎯 *Jenjang:* ${module.grade_level} - ${module.subject_name}\n⏱️ *Estimasi:* ${module.duration_minutes} Menit\n\n🔗 *Buka Modul Interaktif & Lembar Kerja:*\n${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-card text-text-primary print:hidden animate-in fade-in slide-in-from-top-2">
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Action Bar (Hidden during Print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-color pb-4 print:hidden">
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
              {isLinkShared && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Share2 className="w-2.5 h-2.5" />
                  Web Shared
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">{module.topic_title}</h1>
            {module.topic_subtitle && (
              <p className="text-xs text-text-secondary mt-0.5 italic">{module.topic_subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Share Link Modal Trigger */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer font-mono"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Bagikan Link Siswa</span>
          </button>

          {/* Student Edition PDF */}
          <button
            onClick={() => handlePrint('student')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white font-semibold text-xs hover:opacity-90 transition shadow-xs cursor-pointer font-mono"
            title="Cetak lembar kerja siswa tanpa kunci jawaban"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Siswa (LKPD)</span>
          </button>

          {/* Teacher Edition PDF */}
          <button
            onClick={() => handlePrint('teacher')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-color text-text-primary text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer font-mono"
            title="Cetak RPP & kunci jawaban untuk instruktur"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF Guru (RPP)</span>
          </button>

          {/* Duplicate Button */}
          <button
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-color text-text-primary text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            title="Duplikasi modul"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Duplikasi</span>
          </button>

          {/* Use in Daily Report */}
          <button
            onClick={handleUseInReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:opacity-90 transition shadow-xs cursor-pointer font-mono"
          >
            <span>Pakai di Laporan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden animate-in fade-in">
          <div className="bg-card border border-border-color rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-color">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-text-primary font-editorial-headline">
                  Distribusi Modul & Lembar Kerja Siswa
                </h2>
              </div>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Share URL Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary block">
                Link Interaktif Siswa (Zero-Login):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-border-color font-mono text-xs text-text-primary select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2.5 rounded-xl bg-accent text-white text-xs font-mono font-bold hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons: WhatsApp & Direct Preview */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Kirim via WhatsApp</span>
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-background hover:bg-[var(--border-color)] border border-border-color text-text-primary text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka Tampilan Siswa ↗</span>
              </a>
            </div>

            {/* Control Toggles */}
            <div className="pt-3 border-t border-border-color space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-text-primary block">Tautan Aktif (Bisa Diakses)</span>
                  <span className="text-[10px] text-text-secondary">Jika dimatikan, link publik tidak dapat dibuka murid.</span>
                </div>
                <input
                  type="checkbox"
                  checked={isLinkShared}
                  onChange={(e) => handleToggleShare(e.target.checked)}
                  className="w-5 h-5 accent-[#4da23c] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-text-primary block">Tampilkan Petunjuk (Hints) di Web</span>
                  <span className="text-[10px] text-text-secondary">Siswa dapat membuka petunjuk pada misi LKPD.</span>
                </div>
                <input
                  type="checkbox"
                  checked={showHintsOnWeb}
                  onChange={(e) => handleToggleHints(e.target.checked)}
                  className="w-5 h-5 accent-[#4da23c] rounded cursor-pointer"
                />
              </div>

              {/* Revoke / Rotate Token Button */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-text-primary block">Keamanan Tautan</span>
                  <span className="text-[10px] text-text-secondary">Buat ulang token untuk mencabut link lama.</span>
                </div>
                <button
                  onClick={handleRotateToken}
                  disabled={rotatingToken}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-3 h-3 ${rotatingToken ? 'animate-spin' : ''}`} />
                  <span>Rotasi Token</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab Switcher (Hidden during Print) */}
      <div className="flex items-center justify-between border-b border-border-color pb-2 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('student')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 font-mono ${
              activeTab === 'student'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-card border border-border-color text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Artikel & LKPD Siswa (LMS View)</span>
          </button>

          <button
            onClick={() => setActiveTab('teacher')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 font-mono ${
              activeTab === 'teacher'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-card border border-border-color text-text-secondary hover:text-text-primary'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Panduan Guru (RPP & Lesson Plan)</span>
          </button>
        </div>

        {activeTab === 'student' && (
          <button
            onClick={() => setShowAnswerKeys(!showAnswerKeys)}
            className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer font-mono"
          >
            {showAnswerKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showAnswerKeys ? 'Sembunyikan Kunci Jawaban' : 'Tampilkan Kunci Jawaban Guru'}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT ARTICLE & LKPD WORKSHEET PREVIEW                         */}
      {/* ========================================================================= */}
      {(activeTab === 'student' || printMode === 'student') && (
        <div className={`p-6 md:p-10 rounded-3xl bg-white text-neutral-900 border border-neutral-300 shadow-sm max-w-4xl mx-auto space-y-6 font-sans print:border-none print:shadow-none print:p-0 print:max-w-none print:block ${activeTab !== 'student' ? 'hidden print:block' : ''}`}>
          
          {/* Branded White-Label Header */}
          <div className="border-b-2 border-neutral-900 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 text-neutral-900 flex items-center justify-center">
                <Logo className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-black text-xl tracking-tight text-neutral-900 leading-none mb-1">
                  {APP_CONFIG.name}
                </h2>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 font-mono">
                  MODUL INTERAKTIF & LEMBAR KERJA SISWA (LKPD)
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-neutral-600 space-y-0.5 font-mono">
              <div>Mata Pelajaran: <strong className="text-neutral-900">{module.subject_name}</strong></div>
              <div>Tingkat Kelas: <strong className="text-neutral-900">{module.grade_level}</strong></div>
              <div>Durasi: <strong className="text-neutral-900">{module.duration_minutes} Menit</strong></div>
            </div>
          </div>

          {/* Student Fill-in Blanks (Print Only) */}
          <div className="grid grid-cols-3 gap-4 py-2 border-b border-neutral-200 text-xs font-mono text-neutral-700">
            <div>
              <span className="font-semibold">Nama Siswa:</span>
              <span className="inline-block border-b border-neutral-400 w-36 ml-2"></span>
            </div>
            <div>
              <span className="font-semibold">Tanggal:</span>
              <span className="inline-block border-b border-neutral-400 w-28 ml-2"></span>
            </div>
            <div className="text-right">
              <span className="font-semibold">Kelas:</span>
              <span className="inline-block border-b border-neutral-400 w-20 ml-2"></span>
            </div>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-1">
            <h1 className="font-black text-2xl text-neutral-900 tracking-tight font-editorial-headline">
              {module.topic_title}
            </h1>
            {module.topic_subtitle && (
              <p className="text-sm text-neutral-600 italic">
                {module.topic_subtitle}
              </p>
            )}
          </div>

          {/* Hero Callout (Why Does This Matter?) */}
          {module.student_article_json?.hero_callout && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800 uppercase tracking-wider font-mono">
                <span>{module.student_article_json.hero_callout.emoji || '🚀'}</span>
                <span>{module.student_article_json.hero_callout.title || 'Mengapa Topik Ini Penting?'}</span>
              </div>
              <p className="text-neutral-800 leading-relaxed font-medium">
                {module.student_article_json.hero_callout.body}
              </p>
            </div>
          )}

          {/* Article Sections Preview */}
          {module.student_article_json?.article_sections?.map((section) => (
            <div key={section.section_order} className="space-y-3 pt-2">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-300 text-[11px] font-mono font-bold flex items-center justify-center">
                  {section.section_order}
                </span>
                <span>{section.heading}</span>
              </h2>

              <div className="text-xs text-neutral-700 leading-relaxed space-y-2">
                {section.content_markdown.split('\n\n').map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}
              </div>

              {section.fun_callout_box && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  section.fun_callout_box.type === 'fun_fact' ? 'bg-purple-50 border-purple-200 text-purple-900' :
                  section.fun_callout_box.type === 'pro_tip' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                  section.fun_callout_box.type === 'brain_teaser' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                  'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <strong className="block font-mono uppercase text-[10px] tracking-wider">
                    {section.fun_callout_box.title}
                  </strong>
                  <p className="leading-snug">{section.fun_callout_box.content}</p>
                </div>
              )}

              {section.worked_example && (
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-2">
                  <strong className="text-neutral-900 font-bold block">
                    💡 Contoh Kasus & Solusi: {section.worked_example.scenario}
                  </strong>
                  <div className="space-y-1 pl-1">
                    {section.worked_example.steps.map((st, stIdx) => (
                      <div key={stIdx} className="flex items-start gap-1.5 text-neutral-700">
                        <span className="font-bold font-mono text-[11px] text-[#4da23c]">{stIdx + 1}.</span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* LKPD MISSIONS */}
          <div className="space-y-4 pt-4 border-t-2 border-neutral-300">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-black uppercase tracking-wider text-neutral-900 block font-mono">
                🎯 Lembar Kerja Peserta Didik (LKPD):
              </strong>
              <span className="text-[10px] font-mono text-neutral-500">
                {module.student_lkpd_json?.missions?.length || 0} Tantangan
              </span>
            </div>

            {module.student_lkpd_json?.missions?.map((m) => (
              <div key={m.mission_number} className="p-4 rounded-2xl border border-neutral-300 space-y-2.5 break-inside-avoid">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-900 font-mono">
                  <span className="text-sm">
                    Misi #{m.mission_number}: {m.mission_title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-[10px] uppercase">
                    {m.mission_type}
                  </span>
                </div>

                <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                  {m.instruction}
                </p>

                {/* Answer Workspace Box */}
                <div className="p-4 rounded-xl bg-neutral-50/80 border border-dashed border-neutral-300 text-neutral-400 text-xs min-h-[90px] italic font-mono">
                  {m.workspace_placeholder || 'Ruang lembar kerja / jawaban murid...'}
                </div>

                {/* Teacher Answer Key Toggle */}
                {showAnswerKeys && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1 print:hidden">
                    <strong className="block text-emerald-800 font-bold font-mono">🔑 Kunci Jawaban Guru:</strong>
                    <p className="leading-relaxed">
                      {module.teacher_guide_json?.answer_keys?.find(a => a.challenge_number === m.mission_number)?.solution_explanation || 
                       'Lihat pedoman evaluasi guru pada tab Panduan Guru.'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* LKPD Footer */}
          <div className="border-t border-neutral-200 pt-3 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
            <span>{APP_CONFIG.name} — Interactive LMS & LKPD Engine</span>
            <span>Halaman 1 dari 1</span>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEACHER LESSON PLAN (RPP)                                         */}
      {/* ========================================================================= */}
      {(activeTab === 'teacher' || printMode === 'teacher') && (
        <div className={`space-y-6 max-w-4xl mx-auto ${activeTab !== 'teacher' && printMode !== 'teacher' ? 'hidden' : ''} print:block`}>
          
          {/* Print Teacher Header */}
          <div className="hidden print:block p-6 border-b-2 border-black mb-4">
            <h1 className="text-xl font-bold uppercase">{APP_CONFIG.name} - RPP & Panduan Instruktur</h1>
            <p className="text-xs font-mono">{module.subject_name} • {module.grade_level} • {module.duration_minutes} Menit</p>
            <h2 className="text-lg font-black mt-2">{module.topic_title}</h2>
          </div>

          {/* Objectives Card */}
          <div className="p-5 rounded-2xl bg-card border border-border-color space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider font-mono">
              <Target className="w-4 h-4" />
              <span>Tujuan Pembelajaran ({module.framework_name || module.framework_code})</span>
            </div>
            
            <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 pl-1">
              {(module.teacher_guide_json?.learning_objectives || []).map((obj, idx) => (
                <li key={idx} className="leading-relaxed">{obj}</li>
              ))}
            </ul>
          </div>

          {/* Icebreaker / Hook Card */}
          <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
              <Lightbulb className="w-4 h-4" />
              <span>Apersepsi & Icebreaker Hook</span>
            </div>
            <p className="text-xs text-text-primary leading-relaxed bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
              {module.teacher_guide_json?.icebreaker_hook || module.teacher_guide_json?.hook_and_analogy}
            </p>
          </div>

          {/* Timeline Steps */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block font-mono">
              Garis Waktu & Alur Pembelajaran ({module.duration_minutes} Menit)
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

          {/* Misconceptions & Answer Keys */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2.5 shadow-2xs">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block font-mono">
                Miskonsepsi Umum Siswa
              </span>
              <ul className="list-disc list-inside text-xs text-text-secondary space-y-1.5">
                {module.teacher_guide_json?.common_misconceptions?.map((misc, idx) => (
                  <li key={idx} className="leading-relaxed">{misc}</li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border-color space-y-2.5 shadow-2xs">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block font-mono">
                Kunci Jawaban & Rubrik LKPD
              </span>
              <div className="space-y-2 text-xs">
                {module.teacher_guide_json?.answer_keys?.map((ans, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-background border border-border-color space-y-0.5">
                    <strong className="text-text-primary font-mono block">Misi #{ans.challenge_number}:</strong>
                    <p className="text-text-secondary leading-relaxed">{ans.solution_explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Report Pre-filled Seed Notice */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5 print:hidden">
            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              <Bookmark className="w-4 h-4" />
              <span>Ringkasan Otomatis untuk Laporan Harian (Report Seed):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-text-secondary pt-1">
              <div className="bg-background p-3 rounded-xl border border-border-color">
                <strong className="text-text-primary block mb-0.5 font-mono">Pilar 1 (Lesson Overview):</strong>
                {module.report_seed_json?.pillar_1_milestone_summary}
              </div>
              <div className="bg-background p-3 rounded-xl border border-border-color">
                <strong className="text-text-primary block mb-0.5 font-mono">Pilar 3 (Recommended Practice):</strong>
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
            margin: 1.2cm;
            size: A4 portrait;
          }
        }
      `}</style>

    </div>
  )
}
