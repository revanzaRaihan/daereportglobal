'use client'

import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Calendar, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Copy,
  Check,
  Smile,
  Heart,
  Award,
  Maximize2,
  X,
  GraduationCap,
  History,
  MessageCircle,
  FileText,
  Camera,
  ExternalLink
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { APP_CONFIG } from '@/lib/branding'

export interface ParsedReport {
  id: string
  meeting_number: number
  report_date: string
  materi: string
  behavior: string
  image_url: string | null
  lessonCompleted: string
  overview: string
  teachersNote: string
  trainingRecommendation: string
  parentNote: string
  learning_module_id?: number | null
  linked_module?: {
    share_token: string
    topic_title: string
    topic_subtitle?: string
    duration_minutes: number
    is_link_shared: boolean
  } | null
}

interface ParentDashboardProps {
  student: {
    id: string
    name: string
    subject: string
    meeting_count: number | null
    user_id: string
  }
  reports: ParsedReport[]
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 0 && month < 12) {
        return `${day} ${INDONESIAN_MONTHS[month]} ${year}`
      }
    }
    const d = new Date(dateStr)
    return `${d.getDate()} ${INDONESIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function cleanMateri(materiStr: string): string {
  if (!materiStr) return 'Materi Reguler'
  const trimmed = materiStr.trim()

  const match = trimmed.match(/(?:Finishing\s+)?(?:Lesson|Meeting|Pertemuan|Modul|Bab)\s+\d+(?:\s*(?:dan|&|-|,)\s*(?:(?:Lesson|Meeting|Pertemuan)\s+)?\d+)*/i)
  if (match) {
    return match[0].trim()
  }

  const cutoffMatch = trimmed.match(/^([^,.:;\n]+?\d+)/)
  if (cutoffMatch) {
    return cutoffMatch[1].trim()
  }

  return trimmed.split(/[,.:;\n]/)[0].trim()
}

export default function ParentDashboard({ student, reports }: ParentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report')
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }, [])

  const handleCopyText = (text: string, reportId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedReportId(reportId)
    setTimeout(() => setCopiedReportId(null), 2000)
  }

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackText.trim()) return

    // Cooldown rate limit guard (30 seconds per student)
    const lastSent = typeof window !== 'undefined' ? localStorage.getItem(`feedback_sent_${student.id}`) : null
    if (lastSent && Date.now() - Number(lastSent) < 30000) {
      alert('Mohon tunggu sejenak sebelum mengirim masukan berikutnya (jeda 30 detik).')
      return
    }

    setSendingFeedback(true)
    setFeedbackStatus('idle')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          feedback: feedbackText.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirimkan masukan.')
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`feedback_sent_${student.id}`, String(Date.now()))
      }

      setFeedbackStatus('success')
      setFeedbackText('')
    } catch (err: any) {
      console.error('Failed to submit feedback:', err)
      setFeedbackStatus('error')
    } finally {
      setSendingFeedback(false)
    }
  }

  const latestReport = reports[0] || null
  const pastReports = reports.slice(1)

  const HISTORY_PAGE_SIZE = 5
  const totalHistoryPages = Math.ceil(reports.length / HISTORY_PAGE_SIZE)
  const currentHistoryReports = reports.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  )

  const getPaginationItems = () => {
    if (totalHistoryPages <= 5) {
      return Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
    }
    if (historyPage <= 3) {
      return [1, 2, 3, '...', totalHistoryPages]
    }
    if (historyPage >= totalHistoryPages - 2) {
      return [1, '...', totalHistoryPages - 2, totalHistoryPages - 1, totalHistoryPages]
    }
    return [1, '...', historyPage, '...', totalHistoryPages]
  }

  return (
    <div className="min-h-screen bg-[#4da23c] relative overflow-x-hidden font-sans text-neutral-800 antialiased selection:bg-[#FACC15] selection:text-neutral-900 pb-20 pt-4 sm:pt-8 print:bg-white print:p-0 print:text-black">
      
      {/* Playful Background Doodles & Geometric Shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden print:hidden">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full border-[28px] border-amber-300/35 opacity-70" />
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-emerald-300/25 blur-xl" />
        <div className="absolute top-1/4 -right-8 w-32 h-32 rounded-full border-[18px] border-cyan-300/30 opacity-80" />
        <div className="absolute top-1/2 -left-10 w-40 h-40 rounded-full border-[22px] border-yellow-300/35" />
        <div className="absolute top-16 left-8 text-amber-200 text-3xl font-black select-none opacity-60">✕</div>
        <div className="absolute top-48 right-12 text-yellow-100 text-4xl font-black select-none opacity-60">✦</div>
        <div className="absolute top-2/3 right-6 text-cyan-100 text-2xl font-black select-none opacity-60">✕</div>
        <div className="absolute bottom-24 left-10 text-yellow-200 text-4xl font-black select-none opacity-60">✦</div>
      </div>

      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-2 sm:px-6 relative z-10 print:max-w-none print:px-0 transition-all duration-300">

        {/* MAIN REPORT CARD WORKSHEET */}
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] shadow-2xl shadow-emerald-950/20 border-2 sm:border-[6px] border-white overflow-hidden transition-all print:border-0 print:shadow-none print:rounded-none">
          
          {/* PLAYFUL HEADER BANNER */}
          <div className="relative bg-gradient-to-r from-[#216d16] via-[#358025] to-[#4da23c] text-white pt-6 sm:pt-8 pb-7 sm:pb-9 px-4 sm:px-10 overflow-hidden select-none">
            
            {/* Vector Shapes */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-10 -left-10 w-36 h-48 bg-[#FF4757] rounded-full transform -rotate-12 opacity-95" />
              <div className="absolute -top-8 left-20 w-32 h-32 rounded-full border-[18px] border-[#0984E3] opacity-90" />
              
              <div className="absolute top-20 left-2 w-14 h-14">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-[#2ED573] drop-shadow-sm">
                  <path d="M50 0 C60 25 75 25 100 50 C75 75 75 60 50 100 C25 75 40 75 0 50 C25 25 25 40 50 0 Z" />
                  <circle cx="50" cy="50" r="14" fill="#FFA502" />
                </svg>
              </div>

              <span className="absolute top-6 left-32 text-yellow-300 text-2xl font-black">✕</span>
              <div className="absolute top-12 left-52 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              </div>

              <svg className="absolute bottom-3 left-48 w-24 h-6 text-white/70 stroke-current fill-none stroke-[3] stroke-linecap-round" viewBox="0 0 100 20">
                <path d="M0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10" />
              </svg>

              <div className="absolute -top-6 -right-6 w-44 h-44 bg-[#FFA502] rounded-full opacity-95" />
              
              <div className="absolute top-14 right-32 w-14 h-14">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-[#FF6B81]">
                  <circle cx="50" cy="20" r="18" />
                  <circle cx="80" cy="50" r="18" />
                  <circle cx="50" cy="80" r="18" />
                  <circle cx="20" cy="50" r="18" />
                  <circle cx="50" cy="50" r="16" fill="#FEEAA7" />
                </svg>
              </div>
            </div>

            {/* Header Content: Title & Mascots */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight font-[var(--font-rounded,sans-serif)] drop-shadow-sm text-white">
                  Class Report
                </h1>
                <p className="text-white/90 text-xs sm:text-sm font-semibold tracking-wide">
                  Laporan Evaluasi & Progres Belajar Siswa
                </p>
              </div>

              {/* MASCOTS */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 relative transform -rotate-3 hover:scale-105 transition-transform duration-300 filter drop-shadow-md">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <ellipse cx="50" cy="50" rx="38" ry="34" fill="#FFFFFF" stroke="#333333" strokeWidth="3" />
                    <path d="M18 30 C5 35 8 60 22 55 C22 45 20 35 18 30 Z" fill="#FFFFFF" stroke="#333333" strokeWidth="3" />
                    <path d="M12 40 C14 46 16 50 18 52" stroke="#666" strokeWidth="2" strokeLinecap="round" />
                    <path d="M10 44 C12 48 14 52 16 54" stroke="#666" strokeWidth="2" strokeLinecap="round" />
                    <path d="M82 30 C95 35 92 60 78 55 C78 45 80 35 82 30 Z" fill="#FFFFFF" stroke="#333333" strokeWidth="3" />
                    <path d="M88 40 C86 46 84 50 82 52" stroke="#666" strokeWidth="2" strokeLinecap="round" />
                    <ellipse cx="38" cy="45" rx="3.5" ry="5" fill="#333333" />
                    <circle cx="39" cy="43" r="1.5" fill="#FFFFFF" />
                    <ellipse cx="62" cy="45" rx="3.5" ry="5" fill="#333333" />
                    <circle cx="63" cy="43" r="1.5" fill="#FFFFFF" />
                    <path d="M34 37 Q 38 34 42 37" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M58 37 Q 62 34 66 37" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M46 52 Q 50 50 54 52 Q 50 57 46 52 Z" fill="#333333" />
                    <path d="M50 55 Q 46 62 42 60" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M50 55 Q 54 62 58 60" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M48 59 C48 68 56 68 56 59 Z" fill="#FF4757" />
                    <ellipse cx="28" cy="54" rx="5" ry="3" fill="#FFB8B8" opacity="0.8" />
                    <ellipse cx="72" cy="54" rx="5" ry="3" fill="#FFB8B8" opacity="0.8" />
                  </svg>
                </div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 relative transform rotate-6 hover:scale-105 transition-transform duration-300 filter drop-shadow-md -ml-3">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <polygon points="20,40 32,15 45,35" fill="#FF793F" stroke="#333333" strokeWidth="3" />
                    <polygon points="25,35 32,22 40,33" fill="#FFFFFF" />
                    <polygon points="80,40 68,15 55,35" fill="#FF793F" stroke="#333333" strokeWidth="3" />
                    <polygon points="75,35 68,22 60,33" fill="#FFFFFF" />
                    <ellipse cx="50" cy="55" rx="36" ry="32" fill="#FF793F" stroke="#333333" strokeWidth="3" />
                    <path d="M30 65 Q 50 50 70 65 Q 50 85 30 65 Z" fill="#FFFFFF" />
                    <line x1="12" y1="56" x2="28" y2="58" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="10" y1="64" x2="26" y2="63" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="88" y1="56" x2="72" y2="58" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="90" y1="64" x2="74" y2="63" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M33 50 Q 38 43 43 50" stroke="#333" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M57 50 Q 62 43 67 50" stroke="#333" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <polygon points="47,60 53,60 50,64" fill="#333333" />
                    <path d="M50 64 Q 45 70 42 68" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M50 64 Q 55 70 58 68" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <circle cx="28" cy="57" r="4" fill="#FFB8B8" />
                    <circle cx="72" cy="57" r="4" fill="#FFB8B8" />
                  </svg>
                </div>
              </div>

            </div>
          </div>

          {/* MAIN WORKSHEET BODY */}
          <div className="p-3.5 sm:p-7 lg:p-8 space-y-6 sm:space-y-8 bg-white">
            
            {/* STUDENT IDENTITY SECTION: 2 Rows x 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
              
              {/* Student Name */}
              <div className="bg-[#F8F9FA] border-2 border-neutral-200/80 rounded-2xl sm:rounded-full px-4 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between shadow-xs transition-colors hover:border-emerald-300 gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-950 shrink-0 whitespace-nowrap font-[var(--font-rounded,sans-serif)]">
                  Student Name:
                </span>
                <span className="text-sm sm:text-base font-black text-neutral-900 truncate text-right font-[var(--font-rounded,sans-serif)]">
                  {student.name}
                </span>
              </div>

              {/* Subject / Level */}
              <div className="bg-[#F8F9FA] border-2 border-neutral-200/80 rounded-2xl sm:rounded-full px-4 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between shadow-xs transition-colors hover:border-emerald-300 gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-950 shrink-0 whitespace-nowrap font-[var(--font-rounded,sans-serif)]">
                  Level & Subject:
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-neutral-800 truncate text-right flex items-center justify-end gap-1.5 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-[#4da23c] shrink-0" />
                  <span className="truncate">{student.subject}</span>
                </span>
              </div>

              {/* Latest Meeting Date */}
              <div className="bg-[#F8F9FA] border-2 border-neutral-200/80 rounded-2xl sm:rounded-full px-4 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between shadow-xs transition-colors hover:border-emerald-300 gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-950 shrink-0 whitespace-nowrap font-[var(--font-rounded,sans-serif)]">
                  Tanggal Terkini:
                </span>
                <span className="text-xs sm:text-sm font-bold text-neutral-700 flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-[#4da23c] shrink-0" />
                  <span>{latestReport ? formatIndonesianDate(latestReport.report_date) : 'Belum ada data'}</span>
                </span>
              </div>

              {/* Total Meetings */}
              <div className="bg-[#F8F9FA] border-2 border-neutral-200/80 rounded-2xl sm:rounded-full px-4 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between shadow-xs transition-colors hover:border-emerald-300 gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-950 shrink-0 whitespace-nowrap font-[var(--font-rounded,sans-serif)]">
                  Total Pertemuan:
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full whitespace-nowrap shrink-0">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {reports.length} Sesi Selesai
                </span>
              </div>

            </div>

            {/* 2-TAB SEGMENTED CONTROLLER: RAPORT & HISTORY */}
            <div className="flex justify-center pt-1 pb-1">
              <div className="bg-emerald-100/80 p-1 rounded-2xl sm:rounded-full flex items-center gap-1 border border-emerald-200/90 shadow-xs w-full max-w-sm sm:max-w-md">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-[var(--font-rounded,sans-serif)] ${
                    activeTab === 'report'
                      ? 'bg-[#4da23c] text-white shadow-sm'
                      : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-200/50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Raport Terkini</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-[var(--font-rounded,sans-serif)] ${
                    activeTab === 'history'
                      ? 'bg-[#4da23c] text-white shadow-sm'
                      : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-200/50'
                  }`}
                >
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>History Sesi ({reports.length})</span>
                </button>
              </div>
            </div>

            {/* 2-COLUMN DESKTOP SPLIT (HALF & HALF) / 1-COLUMN MOBILE VERTICAL STACK */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              
              {/* ============================================================== */}
              {/* KOLOM 1: Report Terkini (atau Riwayat Sesi)                   */}
              {/* ============================================================== */}
              <div className="space-y-4 w-full">
                {activeTab === 'report' && (
                  latestReport ? (
                    <section className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* Latest Report Card */}
                      <div className="bg-gradient-to-b from-[#F4FAF2] to-white border-2 border-emerald-200/90 rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-6 lg:p-7 space-y-5 sm:space-y-6 shadow-md relative overflow-hidden">
                        
                        {/* Watermark badge */}
                        <div className="absolute top-4 right-6 text-emerald-200/40 font-black text-6xl select-none pointer-events-none font-[var(--font-rounded,sans-serif)] hidden sm:block">
                          #{latestReport.meeting_number}
                        </div>

                        {/* Meeting Meta Header: Tanggal on LEFT, Pertemuan on RIGHT */}
                        <div className="flex items-center justify-between gap-2.5 relative z-10">
                          <span className="text-xs sm:text-sm font-bold text-neutral-600 flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full border border-emerald-100 whitespace-nowrap shrink-0">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4da23c] shrink-0" />
                            <span>{formatIndonesianDate(latestReport.report_date)}</span>
                          </span>
                          <span className="px-3.5 py-1.5 sm:px-4 sm:py-1.5 bg-[#4da23c] text-white text-xs sm:text-sm font-black rounded-full shadow-xs uppercase tracking-wider font-[var(--font-rounded,sans-serif)] whitespace-nowrap shrink-0">
                            Pertemuan Ke-{latestReport.meeting_number}
                          </span>
                        </div>

                        {/* Evaluasi Belajar Guru */}
                        <div className="space-y-2.5 relative z-10">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#4da23c] shrink-0" />
                              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900 font-[var(--font-rounded,sans-serif)] whitespace-nowrap truncate">
                                Evaluasi Belajar Siswa:
                              </h3>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                              Catatan Guru
                            </span>
                          </div>

                          <div className="bg-white border-2 border-emerald-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
                            <div className="text-neutral-900 text-base sm:text-lg leading-[1.8] sm:leading-[1.85] font-medium whitespace-pre-wrap tracking-normal">
                              {latestReport.teachersNote}
                            </div>
                          </div>
                        </div>

                        {/* Rekomendasi Latihan */}
                        {latestReport.trainingRecommendation && latestReport.trainingRecommendation !== 'Tidak ada rekomendasi khusus.' && (
                          <div className="space-y-2 relative z-10">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider font-[var(--font-rounded,sans-serif)]">
                              <Award className="w-4 h-4 text-amber-600" />
                              <span>Rekomendasi Latihan di Rumah:</span>
                            </div>
                            <div className="bg-amber-50/90 border-2 border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-950 text-sm sm:text-base font-medium leading-relaxed shadow-xs">
                              {latestReport.trainingRecommendation}
                            </div>
                          </div>
                        )}

                        {/* Interactive Learning Module & Worksheet (LKPD) Card */}
                        {latestReport.linked_module && latestReport.linked_module.is_link_shared && (
                          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300/80 space-y-2.5 relative z-10 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 font-[var(--font-rounded,sans-serif)] flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4 text-[#4da23c]" />
                                Modul Belajar & Lembar Kerja (LKPD) Hari Ini
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-mono">
                                Akses Interaktif
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm sm:text-base font-extrabold text-neutral-900 font-[var(--font-rounded,sans-serif)]">
                                {latestReport.linked_module.topic_title}
                              </h4>
                              {latestReport.linked_module.topic_subtitle && (
                                <p className="text-xs text-neutral-600 mt-0.5 italic">
                                  {latestReport.linked_module.topic_subtitle}
                                </p>
                              )}
                            </div>

                            <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-mono text-neutral-600">
                                ⏱️ Estimasi Belajar: {latestReport.linked_module.duration_minutes || 60} Menit
                              </span>
                              <a
                                href={`/learn/${latestReport.linked_module.share_token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#4da23c] hover:bg-[#438f34] text-white text-xs font-bold font-[var(--font-rounded,sans-serif)] transition-all shadow-xs cursor-pointer"
                              >
                                <span>Buka Modul & LKPD</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Dokumentasi Foto Kelas */}
                        {latestReport.image_url && (
                          <div className="space-y-2.5 relative z-10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider text-neutral-800 font-[var(--font-rounded,sans-serif)]">
                                Dokumentasi Pembelajaran:
                              </span>
                              <span className="text-xs font-bold text-neutral-400">
                                Klik foto untuk memperbesar
                              </span>
                            </div>

                            <div 
                              onClick={() => setPhotoPreview(latestReport.image_url)}
                              className="rounded-2xl overflow-hidden border-4 border-white shadow-md bg-neutral-100 aspect-video relative group cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={latestReport.image_url} 
                                alt="Dokumentasi Kelas" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-emerald-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/95 text-emerald-950 px-4 py-2 rounded-full text-xs font-black shadow-md flex items-center gap-1.5">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  Buka Foto Penuh
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Switch to History Link */}
                      {pastReports.length > 0 && (
                        <div className="text-center pt-2">
                          <button
                            onClick={() => setActiveTab('history')}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-[#4da23c]" />
                            <span>Lihat riwayat {pastReports.length} pertemuan sebelumnya →</span>
                          </button>
                        </div>
                      )}

                    </section>
                  ) : (
                    <div className="bg-emerald-50/60 border-2 border-dashed border-emerald-200 rounded-3xl p-8 text-center text-emerald-600 text-sm font-bold">
                      Belum ada laporan pertemuan yang tersimpan untuk murid ini.
                    </div>
                  )
                )}

                {/* TAB 2: RIWAYAT / HISTORY */}
                {activeTab === 'history' && (
                  <section className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1 border-b-2 border-emerald-100">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-[#4da23c]" />
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-950 font-[var(--font-rounded,sans-serif)]">
                          Riwayat Semua Pertemuan ({reports.length})
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-neutral-400">
                        Klik sesi untuk melihat catatan
                      </span>
                    </div>

                    {reports.length > 0 ? (
                      <div className="space-y-4">
                        <div className="border-2 border-emerald-200/90 rounded-3xl bg-[#ffffff] overflow-hidden divide-y divide-emerald-100/70 shadow-sm">
                          {currentHistoryReports.map((report) => {
                            const isExpanded = expandedReportId === report.id

                            return (
                              <div key={`history-tab-${report.id}`} className="transition-all">
                                
                                {/* Accordion Trigger */}
                                <div 
                                  onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  className={`flex items-center justify-between p-3.5 sm:p-5 cursor-pointer select-none transition-colors gap-2 ${
                                    isExpanded ? 'bg-emerald-50/60' : 'bg-[#ffffff] hover:bg-emerald-50/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black font-[var(--font-rounded,sans-serif)] shrink-0 whitespace-nowrap">
                                      Pertemuan #{report.meeting_number}
                                    </span>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs sm:text-sm font-bold text-neutral-800 truncate">
                                        {report.materi ? cleanMateri(report.materi) : `${student.subject} — Sesi #${report.meeting_number}`}
                                      </span>
                                      <span className="text-xs text-neutral-400 font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 mt-0.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{formatIndonesianDate(report.report_date)}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <ChevronDown 
                                      className={`w-5 h-5 text-neutral-400 transition-transform duration-300 ${
                                        isExpanded ? 'rotate-180 text-[#4da23c]' : ''
                                      }`}
                                    />
                                  </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                  <div className="p-4 sm:p-6 border-t-2 border-emerald-100/80 bg-[#F9FAF8] space-y-4">
                                    
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-black uppercase text-emerald-950 tracking-wider font-[var(--font-rounded,sans-serif)]">
                                        Evaluasi Belajar Pertemuan #{report.meeting_number}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleCopyText(report.teachersNote, report.id)
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer bg-[#ffffff] px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-50 shadow-2xs transition-colors"
                                      >
                                        {copiedReportId === report.id ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-emerald-600">Disalin</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Salin</span>
                                          </>
                                        )}
                                      </button>
                                    </div>

                                    <div className="bg-[#ffffff] border-2 border-emerald-200/80 p-4 sm:p-5 rounded-2xl text-neutral-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium shadow-2xs">
                                      {report.teachersNote}
                                    </div>

                                    {report.image_url && (
                                      <div className="pt-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-950 tracking-wider font-[var(--font-rounded,sans-serif)]">
                                            <Camera className="w-3.5 h-3.5 text-[#4da23c]" />
                                            <span>Foto Dokumentasi Sesi #{report.meeting_number}:</span>
                                          </div>
                                          <span className="text-[11px] text-neutral-400 font-bold">
                                            Klik untuk memperbesar
                                          </span>
                                        </div>

                                        <div 
                                          onClick={() => setPhotoPreview(report.image_url)}
                                          className="rounded-2xl overflow-hidden border-2 border-emerald-200/90 bg-neutral-100 aspect-video relative group cursor-pointer shadow-xs max-w-lg"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img 
                                            src={report.image_url} 
                                            alt={`Dokumentasi Pertemuan #${report.meeting_number}`} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                          />
                                          <div className="absolute inset-0 bg-emerald-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="bg-white/95 text-emerald-950 px-3.5 py-1.5 rounded-full text-xs font-black shadow-md flex items-center gap-1.5 font-[var(--font-rounded,sans-serif)]">
                                              <Maximize2 className="w-3.5 h-3.5" />
                                              Buka Foto Penuh
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Linked Module Link in History item */}
                                    {report.linked_module && report.linked_module.is_link_shared && (
                                      <div className="pt-2 border-t border-emerald-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-neutral-600 font-[var(--font-rounded,sans-serif)]">
                                          Materi: {report.linked_module.topic_title}
                                        </span>
                                        <a
                                          href={`/learn/${report.linked_module.share_token}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs font-bold text-[#4da23c] hover:underline"
                                        >
                                          <BookOpen className="w-3.5 h-3.5" />
                                          <span>Buka LKPD Sesi Ini ↗</span>
                                        </a>
                                      </div>
                                    )}

                                  </div>
                                )}

                              </div>
                            )
                          })}
                        </div>

                        {/* PAGINATION CONTROLS */}
                        {totalHistoryPages > 1 && (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
                            <span className="text-xs font-bold text-neutral-500 order-2 sm:order-1">
                              Menampilkan {((historyPage - 1) * HISTORY_PAGE_SIZE) + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, reports.length)} dari {reports.length} pertemuan
                            </span>

                            <div className="flex items-center gap-1.5 order-1 sm:order-2">
                              <button
                                onClick={() => {
                                  setHistoryPage((p) => Math.max(1, p - 1))
                                  setExpandedReportId(null)
                                }}
                                disabled={historyPage === 1}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-[#ffffff] text-xs font-bold text-neutral-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#4da23c] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#ffffff] disabled:hover:border-neutral-200 disabled:hover:text-neutral-700 transition-colors cursor-pointer shadow-2xs"
                                title="Halaman Sebelumnya"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Sebelumnya</span>
                              </button>

                              <div className="flex items-center gap-1">
                                {getPaginationItems().map((item, idx) => {
                                  if (item === '...') {
                                    return (
                                      <span key={`dots-${idx}`} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold text-neutral-400">
                                        ...
                                      </span>
                                    )
                                  }

                                  const pageNum = Number(item)
                                  return (
                                    <button
                                      key={`page-${pageNum}`}
                                      onClick={() => {
                                        setHistoryPage(pageNum)
                                        setExpandedReportId(null)
                                      }}
                                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer font-[var(--font-rounded,sans-serif)] ${
                                        historyPage === pageNum
                                          ? 'bg-[#4da23c] text-white shadow-xs'
                                          : 'bg-[#ffffff] border border-neutral-200 text-neutral-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#4da23c] shadow-2xs'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  )
                                })}
                              </div>

                              <button
                                onClick={() => {
                                  setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))
                                  setExpandedReportId(null)
                                }}
                                disabled={historyPage === totalHistoryPages}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-[#ffffff] text-xs font-bold text-neutral-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#4da23c] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#ffffff] disabled:hover:border-neutral-200 disabled:hover:text-neutral-700 transition-colors cursor-pointer shadow-2xs"
                                title="Halaman Berikutnya"
                              >
                                <span className="hidden sm:inline">Berikutnya</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-emerald-50/60 border-2 border-dashed border-emerald-200 rounded-3xl p-8 text-center text-emerald-600 text-sm font-bold">
                        Belum ada riwayat pertemuan.
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* ============================================================== */}
              {/* KOLOM 2: Catatan Pembelajaran & Masukan untuk Guru             */}
              {/* ============================================================== */}
              <div className="space-y-6 w-full">
                
                {/* Catatan Pembelajaran (Yellow Ribbon Card) */}
                <div className="relative overflow-hidden select-none">
                  <div className="bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-200 rounded-3xl p-6 sm:p-7 relative overflow-hidden border-2 border-amber-300/60 shadow-xs">
                    
                    <svg className="absolute top-2 left-1/4 w-32 h-6 text-amber-500/30 stroke-current fill-none stroke-[3]" viewBox="0 0 100 20">
                      <path d="M0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10" />
                    </svg>

                    <span className="absolute top-4 right-1/3 text-amber-600/40 text-xl font-black">✕</span>
                    <div className="absolute bottom-3 left-4 flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                      <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                      <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10">
                      
                      {/* Grade / Learning System Mini Card */}
                      <div className="w-full sm:max-w-xs bg-white/95 rounded-2xl p-4 shadow-sm border border-amber-300/80 space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#4da23c] text-white text-[10px] font-black rounded-full uppercase tracking-wider font-[var(--font-rounded,sans-serif)]">
                          <Smile className="w-3.5 h-3.5 text-yellow-300" />
                          <span>Catatan Pembelajaran</span>
                        </div>
                        <p className="text-xs text-neutral-700 leading-snug font-medium">
                          Evaluasi belajar diperbarui setiap pertemuan agar orang tua dapat senantiasa memantau perkembangan dan memberikan dukungan terbaik di rumah.
                        </p>
                      </div>

                      {/* Stationary Illustrations */}
                      <div className="flex items-center justify-center gap-3 sm:gap-4 shrink-0">
                        
                        {/* Emerald Green Book */}
                        <div className="w-16 h-20 sm:w-20 sm:h-24 relative transform -rotate-12 filter drop-shadow-md">
                          <svg viewBox="0 0 80 100" className="w-full h-full">
                            <rect x="12" y="8" width="62" height="88" rx="4" fill="#E2E8F0" />
                            <rect x="8" y="5" width="60" height="90" rx="5" fill="#10B981" stroke="#047857" strokeWidth="2.5" />
                            <rect x="8" y="5" width="10" height="90" rx="3" fill="#059669" />
                            <rect x="25" y="22" width="34" height="24" rx="3" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.5" />
                          </svg>
                        </div>

                        {/* Artist Paint Palette */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 relative transform rotate-6 filter drop-shadow-md -ml-3">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <path 
                              d="M30 20 C60 10 90 25 90 55 C90 80 65 95 45 90 C25 85 10 75 10 50 C10 30 20 22 30 20 Z" 
                              fill="#FFFBEB" 
                              stroke="#D97706" 
                              strokeWidth="2.5" 
                            />
                            <circle cx="70" cy="65" r="7" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
                            <circle cx="30" cy="35" r="5" fill="#EF4444" />
                            <circle cx="48" cy="28" r="5" fill="#3B82F6" />
                            <circle cx="68" cy="35" r="5" fill="#10B981" />
                            <circle cx="32" cy="55" r="5" fill="#F59E0B" />
                            <circle cx="45" cy="72" r="5" fill="#8B5CF6" />
                          </svg>
                        </div>

                        {/* Blue Ruler */}
                        <div className="w-10 h-24 sm:w-12 sm:h-28 relative transform rotate-45 filter drop-shadow-md -ml-4">
                          <svg viewBox="0 0 35 100" className="w-full h-full">
                            <rect x="3" y="2" width="28" height="96" rx="4" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />
                            <line x1="22" y1="15" x2="31" y2="15" stroke="#FFFFFF" strokeWidth="2" />
                            <line x1="26" y1="25" x2="31" y2="25" stroke="#FFFFFF" strokeWidth="1.5" />
                            <line x1="22" y1="35" x2="31" y2="35" stroke="#FFFFFF" strokeWidth="2" />
                            <line x1="26" y1="45" x2="31" y2="45" stroke="#FFFFFF" strokeWidth="1.5" />
                            <line x1="22" y1="55" x2="31" y2="55" stroke="#FFFFFF" strokeWidth="2" />
                            <line x1="26" y1="65" x2="31" y2="65" stroke="#FFFFFF" strokeWidth="1.5" />
                            <line x1="22" y1="75" x2="31" y2="75" stroke="#FFFFFF" strokeWidth="2" />
                            <line x1="26" y1="85" x2="31" y2="85" stroke="#FFFFFF" strokeWidth="1.5" />
                          </svg>
                        </div>

                      </div>

                    </div>

                  </div>
                </div>

                {/* PARENT FEEDBACK FORM */}
                <div className="print:hidden">
                  <div className="bg-emerald-50/70 border-2 border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5 font-[var(--font-rounded,sans-serif)]">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                        <span>Ada Masukan untuk Guru?</span>
                      </h4>
                      <span className="text-[11px] text-neutral-500 hidden sm:inline font-medium">
                        Terkirim langsung ke guru pembimbing
                      </span>
                    </div>

                    {feedbackStatus === 'success' ? (
                      <div className="p-3 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                        <span>Terima kasih banyak! Pesan Anda telah terkirim.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSendFeedback} className="relative flex items-center">
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Tulis pesan untuk guru..."
                          required
                          className="w-full bg-[#ffffff] text-xs sm:text-sm text-neutral-800 placeholder-neutral-400 py-2.5 pl-3.5 pr-20 rounded-xl border-2 border-emerald-200 focus:outline-none focus:border-[#4da23c] focus:ring-2 focus:ring-[#4da23c]/20 transition-all font-medium shadow-2xs"
                        />
                        <button
                          type="submit"
                          disabled={sendingFeedback || !feedbackText.trim()}
                          className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 rounded-lg bg-[#4da23c] hover:bg-[#3d8630] text-white text-xs font-black shadow-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-[var(--font-rounded,sans-serif)]"
                        >
                          {sendingFeedback ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>Kirim</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {feedbackStatus === 'error' && (
                      <p className="text-[11px] font-bold text-rose-600">
                        Gagal mengirimkan pesan. Silakan coba lagi.
                      </p>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* CARD FOOTER BRANDING */}
          <div className="bg-[#F8F9FA] px-6 py-4 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-neutral-400">
            <span className="uppercase tracking-wider font-[var(--font-rounded,sans-serif)]">
              &copy; {new Date().getFullYear()} {APP_CONFIG.name} &bull; Portal Orang Tua
            </span>
            <span className="text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
              Program: {student.subject}
            </span>
          </div>

        </div>

      </div>

      {/* PHOTO PREVIEW MODAL */}
      {photoPreview && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-fade-in"
          onClick={() => setPhotoPreview(null)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-2 sm:p-3 border-4 border-white">
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={photoPreview} 
              alt="Dokumentasi Kelas Besar" 
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* PRINT MEDIA STYLES */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            padding: 0 !important;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>

    </div>
  )
}
