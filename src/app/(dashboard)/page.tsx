'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { compressImage } from '@/lib/imageCompressor'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import { useTranslation } from '@/components/LocaleProvider'
import { getCachedData, setCachedData } from '@/lib/dataCache'
import { 
  fetchStudentLanguageMap, 
  resolveStudentLanguage 
} from '@/lib/studentLanguage'
import { 
  Sparkles, 
  PenTool,
  Send, 
  Save, 
  Calendar, 
  Hash, 
  Languages, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Clock,
  GraduationCap,
  X,
  Mic,
  MicOff
} from 'lucide-react'

export default function LaporanBuilderPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale, setLocale } = useTranslation()
  const [userId, setUserId] = useState<string | null>(null)
  
  const cachedStudents = getCachedData<any[]>('students')
  const cachedDatasetCount = getCachedData<number>('dataset_count')
  
  // Data States
  const [students, setStudents] = useState<any[]>(cachedStudents || [])
  const [languageMap, setLanguageMap] = useState<Record<string, 'id' | 'en'>>({})
  const [datasetCount, setDatasetCount] = useState<number>(cachedDatasetCount ?? 0)
  
  // Form Inputs
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [meetingNumber, setMeetingNumber] = useState<number>(1)
  const [reportDate, setReportDate] = useState('')
  const [behavior, setBehavior] = useState('')
  const [language, setLanguage] = useState<'id' | 'en'>(locale || 'id')
  const [reportType, setReportType] = useState<'full' | 'overview'>('full')
  const [mode, setMode] = useState<'ai' | 'manual'>('manual')

  // AI Output & History Save States
  const [generatedText, setGeneratedText] = useState('')
  const [warningMsg, setWarningMsg] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // File Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper mappings
  const [meetingNumbersMap, setMeetingNumbersMap] = useState<Record<string, number>>({})
  const [nextDatesMap, setNextDatesMap] = useState<Record<string, string>>({})

  // Speech-to-Text States
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const baseBehaviorRef = useRef<string>('')

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    setSpeechSupported(!!SpeechRecognition)

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  const toggleSpeechToText = () => {
    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      setStatusMsg({ type: 'error', text: t('stt_not_supported') })
      return
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err) {
          console.error(err)
        }
      }
      setIsRecording(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = language === 'en' ? 'en-US' : 'id-ID'
      recognition.continuous = true
      recognition.interimResults = true

      baseBehaviorRef.current = behavior

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''
        for (let i = 0; i < event.results.length; ++i) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += text + ' '
          } else {
            interimTranscript += text
          }
        }
        const prefix = baseBehaviorRef.current ? baseBehaviorRef.current.trim() + ' ' : ''
        const combined = (prefix + finalTranscript + interimTranscript).trimStart()
        setBehavior(combined)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          setStatusMsg({ type: 'error', text: t('stt_error_mic') })
        }
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsRecording(false)
      setStatusMsg({ type: 'error', text: t('stt_error_mic') })
    }
  }

  // Load User, Sync and Fetch data
  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        
        // Fetch students & language fallback map
        const [studentsRes, langMapRes, datasetRes] = await Promise.all([
          supabase.from('students').select('*').order('name'),
          fetchStudentLanguageMap(supabase),
          supabase.from('dataset_entries').select('*', { count: 'exact', head: true })
        ])

        setLanguageMap(langMapRes)
        const count = datasetRes.count
        setDatasetCount(count || 0)
        setCachedData('dataset_count', count || 0)

        if (studentsRes.data) {
          const enrichedStudents = studentsRes.data.map(s => ({
            ...s,
            language: s.language || langMapRes[s.id] || 'id'
          }))
          setStudents(enrichedStudents)
          setCachedData('students', enrichedStudents)

          // Fetch reports to calculate next meeting numbers and dates
          const { data: reportsData } = await supabase
            .from('reports')
            .select('student_id, meeting_number, report_date')
            .order('report_date', { ascending: false })
            .order('meeting_number', { ascending: false })

          const latestReports: Record<string, any> = {}
          reportsData?.forEach(r => {
            if (!latestReports[r.student_id]) {
              latestReports[r.student_id] = r
            }
          })

          const meetNums: Record<string, number> = {}
          const nextDates: Record<string, string> = {}

          enrichedStudents.forEach(s => {
            const lastReport = latestReports[s.id]
            const nextMeet = lastReport ? Number(lastReport.meeting_number) + 1 : Number(s.meeting_count || 0) + 1
            meetNums[s.id] = nextMeet

            let nextDate = ''
            if (lastReport) {
              const fallbackDate = new Date(lastReport.report_date)
              fallbackDate.setDate(fallbackDate.getDate() + 7)
              nextDate = fallbackDate.toISOString().split('T')[0]
            } else {
              nextDate = s.first_meeting_date || new Date().toISOString().split('T')[0]
            }

            nextDates[s.id] = nextDate
          })

          setMeetingNumbersMap(meetNums)
          setNextDatesMap(nextDates)
        }
      }
    }
    initPage()
  }, [supabase])

  // Keep local language in sync with global locale only if no student is selected
  useEffect(() => {
    if (!selectedStudentId && (locale === 'id' || locale === 'en')) {
      setLanguage(locale)
    }
  }, [locale, selectedStudentId])

  const handleLanguageChange = (val: 'id' | 'en') => {
    setLanguage(val)
    setLocale(val)
    if (mode === 'manual' && generatedText) {
      const student = students.find(s => s.id === selectedStudentId)
      if (student) {
        const manualText = assembleManualReport(student, meetingNumber, reportDate, behavior, val)
        setGeneratedText(manualText)
      }
    }
  }

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    if (id) {
      setMeetingNumber(meetingNumbersMap[id] || 1)
      setReportDate(nextDatesMap[id] || '')

      // Auto-detect and bind language from student data
      const student = students.find(s => s.id === id)
      if (student) {
        const studentLang = resolveStudentLanguage(student, languageMap)
        setLanguage(studentLang)

        if (mode === 'manual' && generatedText) {
          const manualText = assembleManualReport(
            student,
            meetingNumbersMap[id] || 1,
            nextDatesMap[id] || '',
            behavior,
            studentLang
          )
          setGeneratedText(manualText)
        }
      }
    } else {
      setMeetingNumber(1)
      setReportDate('')
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) return
    setGenerating(true)
    setGeneratedText('')
    setWarningMsg('')
    setStatusMsg(null)

    if (mode === 'manual') {
      const student = students.find(s => s.id === selectedStudentId)
      if (!student) {
        setGenerating(false)
        return
      }
      setTimeout(() => {
        const manualText = assembleManualReport(student, meetingNumber, reportDate, behavior, language)
        setGeneratedText(manualText)
        setGenerating(false)
      }, 300)
      return
    }

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          meeting_number: meetingNumber,
          report_date: reportDate,
          behavior,
          language,
          report_type: reportType
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatusMsg({ type: 'error', text: data.message || 'Gagal menghasilkan laporan.' })
      } else {
        setGeneratedText(data.text)
        if (data.warning) {
          setWarningMsg(data.warning)
        }
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan sistem.' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveToHistory = async () => {
    if (!selectedStudentId || !generatedText) return
    setSaving(true)
    setStatusMsg(null)

    try {
      let currentUserId = userId
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          currentUserId = user.id
          setUserId(user.id)
        }
      }

      if (!currentUserId) {
        throw new Error(locale === 'id' ? 'Sesi berakhir, silakan login kembali.' : 'Session expired, please login again.')
      }

      let imageUrl: string | null = null

      if (selectedImage) {
        const fileToUpload = await compressImage(selectedImage)
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
        const fileName = `${selectedStudentId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('reports')
          .upload(fileName, fileToUpload, {
            cacheControl: '2592000', // 30 hari cache
            upsert: false
          })

        if (uploadErr) {
          throw new Error('Gagal mengunggah foto: ' + uploadErr.message)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('reports')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      const student = students.find(s => s.id === selectedStudentId)
      const { error: insertErr } = await supabase.from('reports').insert({
        student_id: selectedStudentId,
        student_name: student.name,
        subject: student.subject,
        meeting_number: meetingNumber,
        report_date: reportDate,
        materi: '', // Deprecated, stored as empty string for schema compatibility
        behavior,
        content: generatedText,
        image_url: imageUrl,
        user_id: student?.user_id || currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      if (insertErr) {
        throw new Error(insertErr.message)
      }

      const { count: reportsCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', selectedStudentId)

      await supabase.from('students')
        .update({ meeting_count: reportsCount || 0 })
        .eq('id', selectedStudentId)

      setStatusMsg({ type: 'success', text: 'Laporan berhasil disimpan ke riwayat.' })

      setBehavior('')
      setGeneratedText('')
      setSelectedImage(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      router.refresh()
      
      const nextMeet = meetingNumber + 1
      meetingNumbersMap[selectedStudentId] = nextMeet
      setMeetingNumber(nextMeet)
      
      const checkDate = new Date(reportDate)
      checkDate.setDate(checkDate.getDate() + 7)
      const nextDateStr = checkDate.toISOString().split('T')[0]
      nextDatesMap[selectedStudentId] = nextDateStr
      setReportDate(nextDateStr)

    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal menyimpan laporan.' })
    } finally {
      setSaving(false)
    }
  }

  const currentStudent = students.find(s => s.id === selectedStudentId)

  const studentOptions = students.map(s => {
    const sLang = resolveStudentLanguage(s, languageMap)
    return { 
      value: s.id, 
      label: `${s.name} (${s.subject}) • ${sLang.toUpperCase()}` 
    }
  })

  const languageOptions = [
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'en', label: 'English (EN)' }
  ]

  const reportTypeOptions = [
    { value: 'full', label: t('report_type_full') },
    { value: 'overview', label: t('report_type_overview') }
  ]

  return (
    <div className="space-y-6">
      
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          <PenTool className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">{t('header_create_ai')}</h2>
        </div>
      </div>

      {datasetCount === 0 && (
        <div className="bg-white border border-black text-black text-xs px-4 py-3 rounded-2xl flex gap-3 items-start shadow-none">
          <AlertCircle className="w-4 h-4 text-black mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">{locale === 'id' ? 'Dataset Gaya Kosong' : 'Writing Style Dataset Empty'}</span>
            <p className="mt-0.5 text-neutral-500">
              {locale === 'id' 
                ? 'Silakan tambahkan minimal 1 contoh di tab Dataset Gaya agar AI memahami karakter tulisan Anda.' 
                : 'Please add at least 1 writing example in the Writing Style tab so the AI can learn your writing tone.'}
            </p>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className={`border text-xs px-4 py-3 rounded-2xl flex gap-3 items-start shadow-none bg-white border-black text-black`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-black" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-black" />}
          <span className="font-semibold">{statusMsg.text}</span>
        </div>
      )}

      {/* 2. FILTER & SEARCH BAR (Responsive grid, 16px padding, white, border-1px, py-2.5 inputs h-42px) */}
      <div className="bg-card border border-border-color p-4 rounded-2xl shadow-none grid grid-cols-1 lg:grid-cols-12 gap-4 w-full items-center">
        
        {/* Student Selector: col-span-5, icon-prefix */}
        <div className="relative w-full lg:col-span-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary z-10">
            <GraduationCap className="w-4 h-4" />
          </div>
          <CustomSelect
            options={studentOptions}
            value={selectedStudentId}
            onChange={handleStudentChange}
            placeholder={t('placeholder_student')}
            className="pl-10"
          />
        </div>

        {/* Date Picker: col-span-3 */}
        <div className="relative w-full lg:col-span-3">
          <CustomDatePicker
            value={reportDate}
            onChange={(val) => setReportDate(val)}
            placeholder={t('placeholder_date')}
          />
        </div>

        {/* Language select: col-span-2, icon-prefix */}
        <div className="relative w-full lg:col-span-2">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary z-10">
            <Languages className="w-4 h-4" />
          </div>
          <CustomSelect
            options={languageOptions}
            value={language}
            onChange={(val) => handleLanguageChange(val as any)}
            placeholder={t('placeholder_lang')}
            isSearchable={false}
            className="pl-10"
          />
        </div>

        {/* Summary type select: col-span-2 */}
        <div className="relative w-full lg:col-span-2">
          <CustomSelect
            options={reportTypeOptions}
            value={reportType}
            onChange={(val) => setReportType(val as any)}
            placeholder={t('placeholder_type')}
            isSearchable={false}
            isDisabled={mode === 'manual'}
          />
        </div>

      </div>

      {/* 3. DATA CARD GRID (2-column grid xl:grid-cols-2 with 24px gap-6) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* CARD 1: INPUT DETAILS (padding p-6, rounded-2xl, card-shadow) */}
        <section className="bg-card border border-border-color rounded-2xl p-6 shadow-none space-y-5 transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-color/60">
          {/* Card Header: 48px avatar, title, subtitle, top-right status badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm font-mono uppercase">
                {currentStudent ? currentStudent.name.substring(0, 2).toUpperCase() : 'LS'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-black leading-tight flex items-center gap-2">
                  <span>{currentStudent ? currentStudent.name : t('select_student_prompt')}</span>
                  {currentStudent && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border border-black/10 bg-neutral-100 text-neutral-800">
                      {resolveStudentLanguage(currentStudent, languageMap) === 'en' ? '🇬🇧 EN' : '🇮🇩 ID'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-550 font-medium">
                  {currentStudent ? currentStudent.subject : t('private_tutoring_desc')}
                </p>
              </div>
            </div>

            {/* Status Badge: Compact, color-coded, 10px bold uppercase */}
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/15 text-accent border border-accent/30 font-mono">
              {t('badge_meeting')} {meetingNumber}
            </span>
          </div>

          {/* Form Body */}
          <div className="space-y-5 pt-2">

            {/* Mode Selector Tab Group */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-black/5 dark:bg-black/30 rounded-xl border border-border-color">
              <button
                type="button"
                onClick={() => setMode('ai')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'ai'
                    ? 'bg-accent text-white shadow-xs font-extrabold scale-[1.01]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${mode === 'ai' ? 'text-yellow-300' : 'text-neutral-400'}`} />
                <span>{t('mode_ai')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'manual'
                    ? 'bg-accent text-white shadow-xs font-extrabold scale-[1.01]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <PenTool className={`w-3.5 h-3.5 ${mode === 'manual' ? 'text-white' : 'text-neutral-400'}`} />
                <span>{t('mode_manual')}</span>
              </button>
            </div>

            {/* Manual Meeting Number & Date Override */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border-color focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 rounded-xl p-3.5 bg-input-bg transition-all shadow-2xs hover:border-accent/40">
                <label className="block text-[10px] font-extrabold text-text-secondary uppercase tracking-wider font-mono mb-1">
                  {t('label_meeting_no')}
                </label>
                <div className="relative flex items-center">
                  <span className="text-accent font-mono text-xs font-bold mr-1.5">#</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={meetingNumber}
                    onChange={(e) => setMeetingNumber(Number(e.target.value))}
                    className="w-full bg-transparent border-0 p-0 text-sm text-text-primary font-bold focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border border-border-color focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 rounded-xl p-3.5 bg-input-bg transition-all shadow-2xs hover:border-accent/40">
                <label className="block text-[10px] font-extrabold text-text-secondary uppercase tracking-wider font-mono mb-1">
                  {t('label_report_date')}
                </label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-transparent border-0 p-0 text-sm text-text-primary font-semibold focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* Behavior Area with Speech-to-Text */}
            <div className={`border rounded-xl p-4 bg-input-bg transition-all shadow-2xs ${
              isRecording 
                ? 'border-accent ring-2 ring-accent/20' 
                : 'border-border-color focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 hover:border-accent/40'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-[10px] font-extrabold text-text-secondary uppercase tracking-wider font-mono">
                  {t('label_behavior')}
                </label>
                
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleSpeechToText}
                    title={isRecording ? t('btn_stop_stt') : t('btn_start_stt')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500 text-white animate-pulse shadow-xs'
                        : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <MicOff className="w-3 h-3" />
                        <span>{t('stt_listening')}</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3 text-accent" />
                        <span>{t('btn_start_stt')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                required
                rows={3}
                value={behavior}
                onChange={(e) => setBehavior(e.target.value)}
                placeholder={t('placeholder_behavior')}
                className="w-full bg-transparent border-0 p-0 text-xs text-text-primary leading-relaxed focus:ring-0 focus:outline-none resize-y min-h-[70px] placeholder:text-text-secondary/50 font-medium"
              />
              {isRecording && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border-color text-[11px] text-rose-500 font-mono font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>{language === 'en' ? 'Listening in English... Speak clearly into your microphone' : 'Mendengarkan dalam Bahasa Indonesia... Silakan bicara'}</span>
                </div>
              )}
            </div>

            {/* Optional Image Upload */}
            <div>
              <label className="block text-[10px] font-extrabold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                <ImageIcon className="w-3.5 h-3.5 text-accent" />
                {t('label_progress_photo')}
              </label>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                className="hidden"
              />
              
              {!selectedImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border-color hover:border-accent bg-input-bg rounded-xl p-5 text-center cursor-pointer transition-all duration-200 group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-xs font-bold text-text-primary font-mono uppercase tracking-wider group-hover:text-accent transition-colors">
                    {t('btn_choose_image')}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {t('label_choose_image_desc')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border border-border-color bg-input-bg rounded-xl shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-border-color bg-neutral-50 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={URL.createObjectURL(selectedImage)} 
                        alt="Preview" 
                        className="w-full h-full object-cover filter contrast-105"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate max-w-[150px] sm:max-w-[250px]">
                        {selectedImage.name}
                      </p>
                      <p className="text-[10px] text-text-secondary font-mono font-bold">
                        {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="p-1.5 text-text-secondary hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Card Footer: Generate trigger Button */}
          <div className="pt-2 border-t border-border-color">
            <button
              type="submit"
              onClick={handleGenerate}
              disabled={generating || !selectedStudentId}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent text-white text-xs font-extrabold uppercase tracking-wider py-3.5 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{t('btn_generating')}</span>
                </>
              ) : (
                <>
                  {mode === 'ai' ? (
                    <>
                      <Send className="w-4 h-4 text-white" />
                      <span>{t('btn_generate')}</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-4 h-4 text-white" />
                      <span>{t('btn_format_report')}</span>
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </section>

        {/* CARD 2: EDITOR & SAVE (padding p-6, rounded-2xl, card-shadow) */}
        <section className="bg-card border border-border-color rounded-2xl p-6 shadow-none space-y-5 transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-color/60">
          
          {/* Card Header: 48px avatar, title, subtitle, top-right status badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary leading-tight">{t('card_draft_title')}</h3>
                <p className="text-xs text-text-secondary font-medium">
                  {generatedText 
                    ? t('draft_ready_desc')
                    : t('draft_empty_desc')}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-mono ${
              generatedText 
                ? 'bg-accent text-white shadow-xs' 
                : 'bg-black/5 dark:bg-white/5 text-text-secondary border border-border-color'
            }`}>
              {generatedText ? 'READY' : 'EMPTY'}
            </span>
          </div>

          {/* Form Body / Content Area */}
          <div className="space-y-4 min-h-[295px] flex flex-col justify-between">
            {!generatedText && !generating && (
              <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-text-secondary border-2 border-dashed border-border-color bg-input-bg/70 rounded-xl min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <span className="text-xs font-bold text-text-primary font-mono">{t('waiting_report_title')}</span>
                <p className="text-[10px] text-text-secondary mt-1 max-w-[250px]">
                  {t('waiting_report_desc')}
                </p>
              </div>
            )}

            {generating && (
              <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-text-secondary bg-input-bg border-2 border-dashed border-accent/40 rounded-xl min-h-[200px] space-y-2">
                <Loader2 className="w-7 h-7 text-accent animate-spin" />
                <span className="text-xs font-bold text-text-primary font-mono">{t('processing_report_title')}</span>
                <p className="text-[10px] text-text-secondary mt-1 max-w-[220px]">
                  {t('processing_report_desc')}
                </p>
              </div>
            )}

            {generatedText && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                {warningMsg && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[10px] px-3.5 py-2 rounded-xl flex gap-2 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <span>{warningMsg}</span>
                  </div>
                )}

                {/* Edit content textarea */}
                <div className="flex-1 flex flex-col">
                  <textarea
                    rows={10}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    className="w-full flex-1 bg-input-bg border border-border-color rounded-xl p-4 text-xs text-text-primary font-mono leading-relaxed focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card Footer: Save Trigger Button */}
          {generatedText && (
            <div className="pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={handleSaveToHistory}
                disabled={saving}
                className="w-full bg-accent hover:bg-accent-hover disabled:bg-neutral-200 text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{t('btn_saving')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-white" />
                    <span>{t('btn_save')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function assembleManualReport(
  student: { name: string; subject: string },
  meetingNumber: number,
  date: string,
  behavior: string,
  language: 'id' | 'en' = 'id'
): string {
  // Format date to DD/MM/YYYY
  let formattedDate = ''
  try {
    const dateObj = new Date(date)
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()
    formattedDate = `${day}/${month}/${year}`
  } catch (e) {
    formattedDate = date
  }

  const line1 = formattedDate
  const line2 = language === 'id'
    ? `${student.subject} Pertemuan ${meetingNumber}`
    : `${student.subject} Meeting ${meetingNumber}`

  const line3 = (behavior || '').trim()

  return `${line1}\n${line2}\n${line3}`
}
