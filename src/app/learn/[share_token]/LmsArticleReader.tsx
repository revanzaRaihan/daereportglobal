'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PublicLearnerModule, FunCalloutType, MissionType } from '@/lib/modules/types'
import confetti from 'canvas-confetti'
import {
  Sparkles,
  Printer,
  Share2,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Target,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Copy,
  Check,
  Flame,
  Zap,
  Lightbulb,
  BookmarkCheck,
  ArrowRight,
  RotateCcw
} from 'lucide-react'

interface LmsArticleReaderProps {
  module: PublicLearnerModule
}

export default function LmsArticleReader({ module }: LmsArticleReaderProps) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeSectionId, setActiveSectionId] = useState<string>('intro')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [openHints, setOpenHints] = useState<Record<number, boolean>>({})
  const [missionAnswers, setMissionAnswers] = useState<Record<number, string>>({})
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [copiedLink, setCopiedLink] = useState(false)
  const [celebrated, setCelebrated] = useState(false)

  const localStorageKey = `daely_learner_${module.share_token}`

  // Load saved student progress & answers from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(localStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.answers) setMissionAnswers(parsed.answers)
        if (parsed.checklist) setChecklist(parsed.checklist)
      }
    } catch {
      // Ignore
    }
  }, [localStorageKey])

  // Save student progress to localStorage
  const saveProgress = (newAnswers: Record<number, string>, newChecklist: Record<string, boolean>) => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify({ answers: newAnswers, checklist: newChecklist }))
    } catch {
      // Ignore
    }
  }

  // Scroll listener for reading progress bar and TOC spy
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        const current = (window.scrollY / totalHeight) * 100
        setScrollProgress(Math.min(100, Math.max(0, current)))
      }

      // TOC Intersection observer alternative
      const headings = document.querySelectorAll('[data-toc-id]')
      let currentActive = 'intro'
      headings.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top <= 160) {
          currentActive = el.getAttribute('data-toc-id') || currentActive
        }
      })
      setActiveSectionId(currentActive)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Toggle dark mode
  const toggleDarkMode = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Toggle interactive hints
  const toggleHint = (missionNum: number) => {
    setOpenHints(prev => ({ ...prev, [missionNum]: !prev[missionNum] }))
  }

  // Update mission answer
  const handleAnswerChange = (missionNum: number, text: string) => {
    const nextAnswers = { ...missionAnswers, [missionNum]: text }
    setMissionAnswers(nextAnswers)
    saveProgress(nextAnswers, checklist)
  }

  // Toggle checklist item
  const toggleChecklistItem = (key: string) => {
    const nextChecklist = { ...checklist, [key]: !checklist[key] }
    setChecklist(nextChecklist)
    saveProgress(missionAnswers, nextChecklist)

    // Check if everything is completed for confetti
    const allMissions = module.student_lkpd_json.missions || []
    const allReflection = module.student_lkpd_json.self_reflection_check || []
    const totalItems = allMissions.length + allReflection.length
    const completedCount = Object.values(nextChecklist).filter(Boolean).length

    if (completedCount >= totalItems && !celebrated) {
      triggerConfetti()
      setCelebrated(true)
    }
  }

  // Confetti celebration
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      })
    } catch {
      // Fallback
    }
  }

  // Copy shareable link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  // Print mode
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  // Reset student worksheet
  const handleResetWorksheet = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh lembar jawaban dan checklist?')) {
      setMissionAnswers({})
      setChecklist({})
      setCelebrated(false)
      localStorage.removeItem(localStorageKey)
    }
  }

  // Progress metrics
  const totalMissions = module.student_lkpd_json.missions?.length || 0
  const totalReflections = module.student_lkpd_json.self_reflection_check?.length || 0
  const totalTasks = totalMissions + totalReflections
  const completedTasks = Object.values(checklist).filter(Boolean).length
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div 
      data-lenis-prevent
      className="min-h-screen select-text bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 font-sans selection:bg-[#4da23c]/20 selection:text-[#4da23c]"
    >
      
      {/* 1. TOP STICKY READING PROGRESS & ACTION BAR */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-[var(--border-color)] print:hidden">
        {/* Scroll Progress Bar */}
        <div 
          className="h-1 bg-[#4da23c] transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#4da23c] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#4da23c] block truncate">
                {module.branch_name || 'Daely Learning Studio'}
              </span>
              <h1 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate font-editorial-headline">
                {module.topic_title}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Completion indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-mono">
              <CheckCircle2 className={`w-3.5 h-3.5 ${completionPercentage === 100 ? 'text-[#4da23c]' : 'text-neutral-400'}`} />
              <span className="font-bold">{completionPercentage}%</span>
            </div>

            {/* Print / Download Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[#4da23c] hover:text-white border border-[var(--border-color)] text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Cetak Lembar Kerja (A4)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cetak LKPD</span>
            </button>

            {/* Copy Share Link */}
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Salin tautan modul ini"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#4da23c]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Tersalin' : 'Bagikan'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-primary)] transition-all cursor-pointer"
              title="Ganti Tema Gelap / Terang"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* PRINT-ONLY HEADER (A4 WORKSHEET TEMPLATE) */}
      <div className="hidden print:block p-8 border-b-2 border-black mb-6">
        <div className="flex justify-between items-start pb-4 border-b border-black/40">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">{module.branch_name || 'Daely Learning Studio'}</h1>
            <p className="text-xs font-mono text-neutral-600">Lembar Kerja Peserta Didik (LKPD) & Modul Belajar</p>
          </div>
          <div className="text-right text-xs font-mono">
            <p className="font-bold">{module.subject_name} • {module.grade_level}</p>
            <p>Durasi: {module.duration_minutes} Menit</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-xs font-mono pb-2">
          <div className="border-b border-black pb-1">Nama Siswa: ______________________</div>
          <div className="border-b border-black pb-1">Tanggal: ______________________</div>
          <div className="border-b border-black pb-1">Kelas: ______________________</div>
        </div>
        <div className="mt-4">
          <h2 className="text-xl font-black text-black">{module.topic_title}</h2>
          {module.topic_subtitle && <p className="text-sm italic text-neutral-700 mt-0.5">{module.topic_subtitle}</p>}
        </div>
      </div>

      {/* 2. MAIN CONTAINER (2-COL DESKTOP / 1-COL MOBILE) */}
      <article className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* ============================================================== */}
          {/* LEFT/MAIN COLUMN (Article Content & Interactive LKPD Flow)    */}
          {/* ============================================================== */}
          <div className="lg:col-span-8 space-y-10">

            {/* EDITORIAL HERO SECTION */}
            <section data-toc-id="intro" className="space-y-4">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-3 py-1 rounded-full bg-[#4da23c]/15 text-[#4da23c] font-bold border border-[#4da23c]/30">
                  {module.subject_name}
                </span>
                <span className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold border border-[var(--border-color)]">
                  {module.grade_level}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  {module.difficulty_badge || 'Beginner'}
                </span>
                <span className="px-2.5 py-1 text-[var(--text-secondary)] flex items-center gap-1 ml-auto">
                  <Clock className="w-3.5 h-3.5" />
                  ~{module.estimated_read_mins || 10} menit baca
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] text-[var(--text-primary)] font-editorial-headline">
                {module.topic_title}
              </h1>

              {/* Subtitle / Engaging Hook */}
              {module.topic_subtitle && (
                <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed font-medium">
                  {module.topic_subtitle}
                </p>
              )}

              {/* Hero Callout Box: Why Does This Matter? */}
              {module.student_article_json?.hero_callout && (
                <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#4da23c]/10 via-[var(--bg-secondary)] to-[var(--bg-secondary)] border-2 border-[#4da23c]/30 shadow-xs relative overflow-hidden">
                  <div className="flex items-start gap-3.5">
                    <span className="text-3xl select-none shrink-0" role="img" aria-label="hero emoji">
                      {module.student_article_json.hero_callout.emoji || '🚀'}
                    </span>
                    <div className="space-y-1">
                      <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#4da23c] font-mono">
                        {module.student_article_json.hero_callout.title || 'Why Does This Matter?'}
                      </h2>
                      <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed font-medium">
                        {module.student_article_json.hero_callout.body}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ARTICLE SECTIONS */}
            {module.student_article_json?.article_sections?.map((section) => (
              <section 
                key={section.section_order} 
                data-toc-id={`section-${section.section_order}`}
                className="space-y-6 pt-4 border-t border-[var(--border-color)]"
              >
                {/* Section Header */}
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-mono font-bold text-[#4da23c] px-2 py-0.5 rounded-md bg-[#4da23c]/10 shrink-0">
                    0{section.section_order}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] font-editorial-headline">
                    {section.heading}
                  </h2>
                </div>

                {/* Section Markdown Body */}
                <div className="prose prose-neutral dark:prose-invert max-w-none text-base sm:text-lg leading-[1.8] text-[var(--text-primary)] space-y-4">
                  {section.content_markdown.split('\n\n').map((paragraph, pIdx) => (
                    <p key={pIdx} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Themed Fun Callout Box */}
                {section.fun_callout_box && (
                  <div className={`p-4 sm:p-5 rounded-2xl border text-sm sm:text-base space-y-1.5 transition-all shadow-xs ${
                    section.fun_callout_box.type === 'fun_fact'
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200'
                      : section.fun_callout_box.type === 'pro_tip'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                      : section.fun_callout_box.type === 'brain_teaser'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-200'
                  }`}>
                    <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                      {section.fun_callout_box.type === 'fun_fact' && <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />}
                      {section.fun_callout_box.type === 'pro_tip' && <Zap className="w-4 h-4 text-emerald-500 shrink-0" />}
                      {section.fun_callout_box.type === 'brain_teaser' && <Flame className="w-4 h-4 text-amber-500 shrink-0" />}
                      {section.fun_callout_box.type === 'remember_this' && <BookmarkCheck className="w-4 h-4 text-blue-500 shrink-0" />}
                      <span>{section.fun_callout_box.title}</span>
                    </div>
                    <p className="leading-relaxed font-medium">
                      {section.fun_callout_box.content}
                    </p>
                  </div>
                )}

                {/* Worked Example Card */}
                {section.worked_example && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#4da23c] flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4" />
                        Studi Kasus & Contoh Terpecahkan
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        Langkah Bertahap
                      </span>
                    </div>

                    <p className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {section.worked_example.scenario}
                    </p>

                    {/* Step-by-step breakdown */}
                    <div className="space-y-2.5">
                      {section.worked_example.steps?.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                          <span className="w-5 h-5 rounded-full bg-[#4da23c] text-white text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>

                    {section.worked_example.takeaway && (
                      <div className="pt-2 text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1.5 border-t border-[var(--border-color)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4da23c]" />
                        <span><strong>Kunci Penting:</strong> {section.worked_example.takeaway}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}

            {/* KEY VOCABULARY SECTION */}
            {module.student_article_json?.key_vocabulary && module.student_article_json.key_vocabulary.length > 0 && (
              <section data-toc-id="vocabulary" className="space-y-4 pt-6 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-[#4da23c]" />
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-editorial-headline">
                    Kosakata & Konsep Kunci
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {module.student_article_json.key_vocabulary.map((vocab, vIdx) => (
                    <div 
                      key={vIdx}
                      className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[#4da23c]/60 transition-all space-y-1"
                    >
                      <span className="text-xs font-bold font-mono text-[#4da23c] block">
                        {vocab.term}
                      </span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                        {vocab.simple_definition}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ============================================================== */}
            {/* INTERACTIVE LKPD WORKSHEET MISSIONS                            */}
            {/* ============================================================== */}
            <section data-toc-id="lkpd" className="space-y-8 pt-8 border-t-2 border-[#4da23c]/40">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4da23c]/15 text-[#4da23c] text-xs font-mono font-bold uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5" />
                  Lembar Kerja Peserta Didik (LKPD)
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)] font-editorial-headline">
                  Tantangan Misi Praktik Mandiri
                </h2>
                <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                  Kerjakan misi interaktif di bawah ini langsung pada layar Anda atau cetak sebagai lembar kerja cetak.
                </p>
              </div>

              {/* MISSION CARDS */}
              <div className="space-y-6">
                {module.student_lkpd_json?.missions?.map((mission) => {
                  const missionKey = `mission_${mission.mission_number}`
                  const isDone = Boolean(checklist[missionKey])
                  const currentAnswer = missionAnswers[mission.mission_number] || ''

                  return (
                    <div 
                      key={mission.mission_number}
                      data-toc-id={`mission-${mission.mission_number}`}
                      className={`p-5 sm:p-7 rounded-2xl border-2 transition-all space-y-5 relative ${
                        isDone 
                          ? 'bg-[#4da23c]/5 border-[#4da23c]/40' 
                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--text-primary)]/30'
                      }`}
                    >
                      {/* Mission Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              mission.mission_type === 'boss_challenge'
                                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                : mission.mission_type === 'core_practice'
                                ? 'bg-emerald-500/20 text-[#4da23c]'
                                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            }`}>
                              {mission.mission_type === 'boss_challenge' ? '🔥 Boss Challenge' : mission.mission_type === 'core_practice' ? '⚡ Core Practice' : '🌱 Warm-Up'}
                            </span>
                            <span className="text-xs font-mono text-[var(--text-secondary)]">
                              Tantangan #{mission.mission_number}
                            </span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] font-editorial-headline">
                            {mission.mission_title}
                          </h3>
                        </div>

                        {/* Interactive Completion Checkbox */}
                        <button
                          onClick={() => toggleChecklistItem(missionKey)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 print:hidden ${
                            isDone 
                              ? 'bg-[#4da23c] text-white border-[#4da23c]' 
                              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[#4da23c]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isDone ? 'Selesai' : 'Tandai Selesai'}</span>
                        </button>
                      </div>

                      {/* Instruction */}
                      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed font-medium">
                          {mission.instruction}
                        </p>
                      </div>

                      {/* Interactive Hint Accordion (Web Only) */}
                      {module.show_hints_on_web && mission.interactive_hint && (
                        <div className="border border-amber-500/30 rounded-xl overflow-hidden print:hidden">
                          <button
                            onClick={() => toggleHint(mission.mission_number)}
                            className="w-full px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200 text-xs font-mono font-bold flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                              Butuh Petunjuk Misi Ini?
                            </span>
                            {openHints[mission.mission_number] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {openHints[mission.mission_number] && (
                            <div className="p-4 bg-[var(--bg-primary)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed border-t border-amber-500/20">
                              💡 {mission.interactive_hint}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Interactive Workspace Area */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                          <span>Ruang Jawaban / Kode / Catatan Anda:</span>
                          <span className="hidden sm:inline text-[10px] text-neutral-400">Tersimpan otomatis</span>
                        </div>
                        <textarea
                          rows={4}
                          value={currentAnswer}
                          onChange={(e) => handleAnswerChange(mission.mission_number, e.target.value)}
                          placeholder={mission.workspace_placeholder || 'Ketik jawaban atau kode percobaan Anda di sini...'}
                          className="w-full p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[#4da23c] focus:outline-none text-sm font-mono text-[var(--text-primary)] resize-y leading-relaxed print:hidden"
                        />
                        {/* Print Only Lined Answer Box */}
                        <div className="hidden print:block border-2 border-dashed border-black/40 rounded-xl h-36 p-3 text-xs font-mono text-neutral-500">
                          {currentAnswer || '[ Tuliskan solusi / kode / diagram siswa di dalam kotak ini ]'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* SELF-REFLECTION CHECKLIST */}
              {module.student_lkpd_json?.self_reflection_check && module.student_lkpd_json.self_reflection_check.length > 0 && (
                <div data-toc-id="reflection" className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#4da23c]" />
                    <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-editorial-headline">
                      Refleksi Diri & Pemahaman Mandiri
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {module.student_lkpd_json.self_reflection_check.map((reflection, rIdx) => {
                      const refKey = `reflection_${rIdx}`
                      const checked = Boolean(checklist[refKey])

                      return (
                        <label 
                          key={rIdx}
                          className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[#4da23c]/50 transition-all cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChecklistItem(refKey)}
                            className="mt-1 w-4 h-4 accent-[#4da23c] rounded cursor-pointer"
                          />
                          <span className={`text-xs sm:text-sm leading-relaxed ${checked ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-medium'}`}>
                            {reflection}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* CELEBRATION BUTTON (FINISH MODULE) */}
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#4da23c]/10 via-[var(--bg-secondary)] to-[var(--bg-secondary)] border-2 border-[#4da23c]/40 text-center space-y-4 print:hidden">
                <span className="text-4xl select-none inline-block animate-bounce">
                  🎉
                </span>
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] font-editorial-headline">
                    Hebat! Anda Telah Mempelajari Modul Ini
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                    Periksa kembali hasil lembar kerja Anda. Anda dapat mengunduh atau mencetak hasil LKPD untuk diserahkan ke pengajar.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={triggerConfetti}
                    className="px-5 py-2.5 rounded-xl bg-[#4da23c] hover:bg-[#438f34] text-white text-xs font-mono font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Rayakan Pencapaian!</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Lembar Kerja (PDF)</span>
                  </button>
                </div>
              </div>

            </section>

          </div>

          {/* ============================================================== */}
          {/* RIGHT STICKY SIDEBAR (LMS Navigation, TOC & Checklist)        */}
          {/* ============================================================== */}
          <aside className="lg:col-span-4 space-y-6 sticky top-20 hidden lg:block print:hidden">

            {/* PROGRESS CARD */}
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Progres Belajar Anda
                </span>
                <span className="text-xs font-mono font-bold text-[#4da23c]">
                  {completionPercentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
                <div 
                  className="h-full bg-[#4da23c] transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] pt-1">
                <span>{completedTasks} dari {totalTasks} tugas selesai</span>
                {completedTasks > 0 && (
                  <button 
                    onClick={handleResetWorksheet}
                    className="hover:text-red-500 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Mulai Ulang Lembar Kerja"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* INTERACTIVE TABLE OF CONTENTS */}
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3 shadow-xs">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5 pb-2 border-b border-[var(--border-color)]">
                <BookOpen className="w-3.5 h-3.5 text-[#4da23c]" />
                Daftar Isi Modul
              </h3>

              <nav className="space-y-1 text-xs font-mono">
                <a
                  href="#intro"
                  className={`block px-3 py-2 rounded-xl transition-all ${
                    activeSectionId === 'intro'
                      ? 'bg-[#4da23c] text-white font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  🚀 Pengenalan & Relevansi
                </a>

                {module.student_article_json?.article_sections?.map((sec) => (
                  <a
                    key={sec.section_order}
                    href={`#section-${sec.section_order}`}
                    className={`block px-3 py-2 rounded-xl transition-all truncate ${
                      activeSectionId === `section-${sec.section_order}`
                        ? 'bg-[#4da23c] text-white font-bold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    0{sec.section_order}. {sec.heading}
                  </a>
                ))}

                {module.student_article_json?.key_vocabulary && module.student_article_json.key_vocabulary.length > 0 && (
                  <a
                    href="#vocabulary"
                    className={`block px-3 py-2 rounded-xl transition-all ${
                      activeSectionId === 'vocabulary'
                        ? 'bg-[#4da23c] text-white font-bold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    📖 Kosakata Kunci
                  </a>
                )}

                <a
                  href="#lkpd"
                  className={`block px-3 py-2 rounded-xl transition-all ${
                    activeSectionId === 'lkpd' || activeSectionId.startsWith('mission-')
                      ? 'bg-[#4da23c] text-white font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  🎯 Lembar Kerja (LKPD)
                </a>

                {module.student_lkpd_json?.missions?.map((m) => (
                  <a
                    key={m.mission_number}
                    href={`#mission-${m.mission_number}`}
                    className={`block pl-6 pr-3 py-1.5 rounded-xl transition-all truncate text-[11px] ${
                      activeSectionId === `mission-${m.mission_number}`
                        ? 'text-[#4da23c] font-bold bg-[#4da23c]/10'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Misi {m.mission_number}: {m.mission_title}
                  </a>
                ))}
              </nav>
            </div>

            {/* QUICK ACTIONS & SHARING CARD */}
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Bagikan Modul Ini
              </span>
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#4da23c]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Berhasil Disalin!' : 'Salin Tautan Web'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="w-full py-2.5 px-3 rounded-xl bg-[#4da23c] hover:bg-[#438f34] text-white text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>

          </aside>

        </div>
      </article>

      {/* FOOTER */}
      <footer className="border-t border-[var(--border-color)] py-8 mt-12 bg-[var(--bg-secondary)] print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[var(--text-secondary)]">
          <p>
            &copy; {new Date().getFullYear()} {module.branch_name || 'Daely Report Studio'} • Interactive Learning Module Engine
          </p>
          <div className="flex items-center gap-4">
            <span>{module.framework_name || 'Kurikulum Terpadu'}</span>
            <span>•</span>
            <span>Mode Zero-Login Siswa</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
