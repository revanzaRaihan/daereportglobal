'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import { useTranslation } from '@/components/LocaleProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { getCachedData, setCachedData } from '@/lib/dataCache'
import { slugify } from '@/lib/slug'
import { 
  fetchStudentLanguageMap, 
  saveStudentLanguageFallback, 
  resolveStudentLanguage 
} from '@/lib/studentLanguage'
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Loader2,
  X,
  Search,
  BookOpen,
  Share2,
  Copy,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Languages
} from 'lucide-react'

export default function StudentsPage() {
  const supabase = createClient()
  const { t, locale } = useTranslation()
  const { confirm } = useConfirm()
  const [userId, setUserId] = useState<string | null>(null)

  const cachedStudents = getCachedData<any[]>('students')
  const cachedOverview = getCachedData<any[]>('teachers_overview')
  const cachedAllTeachers = getCachedData<any[]>('all_teachers')

  // Loaders & Errors
  const [loading, setLoading] = useState(!cachedStudents)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Multi-User & Admin States
  const [isAdmin, setIsAdmin] = useState(false)
  const [teachersOverview, setTeachersOverview] = useState<any[]>(cachedOverview || [])
  const [allTeachers, setAllTeachers] = useState<any[]>(cachedAllTeachers || [])
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null)
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('')

  // Transfer Student Modal State
  const [transferModalStudent, setTransferModalStudent] = useState<any | null>(null)
  const [targetTeacherId, setTargetTeacherId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)

  // Students Data States
  const [students, setStudents] = useState<any[]>(cachedStudents || [])
  const [languageMap, setLanguageMap] = useState<Record<string, 'id' | 'en'>>({})
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any | null>(null)
  const [studentName, setStudentName] = useState('')
  const [studentSubject, setStudentSubject] = useState('')
  const [studentFirstMeeting, setStudentFirstMeeting] = useState('')
  const [studentMeetingCount, setStudentMeetingCount] = useState<number>(0)
  const [studentLanguage, setStudentLanguage] = useState<'id' | 'en'>('id')
  const [searchQuery, setSearchQuery] = useState('')

  // Share Portal Modal State
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareText, setShareText] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  // --- FETCH DATA ---
  const fetchData = async () => {
    if (!students.length) {
      setLoading(true)
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)
      const userIsAdmin = user.app_metadata?.role === 'admin'
      setIsAdmin(userIsAdmin)

      // 1. Fetch Students & Language Fallback Map
      const [studentsRes, langMapRes] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        fetchStudentLanguageMap(supabase)
      ])

      setLanguageMap(langMapRes)

      if (studentsRes.data) {
        const enriched = studentsRes.data.map(s => ({
          ...s,
          language: s.language || langMapRes[s.id] || 'id'
        }))
        setStudents(enriched)
        setCachedData('students', enriched)
      }

      // 2. If Admin, fetch teacher overview & all registered teachers for transfer
      if (userIsAdmin) {
        const { data: overview } = await supabase.rpc('get_teachers_overview')
        if (overview) {
          setTeachersOverview(overview)
          setCachedData('teachers_overview', overview)
        }

        const { data: teachersList } = await supabase.rpc('get_all_teachers')
        if (teachersList) {
          setAllTeachers(teachersList)
          setCachedData('all_teachers', teachersList)
        }
      }
    } catch (err: any) {
      console.error(err)
      triggerToast('error', 'Gagal memuat data murid.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenTransferModal = (student: any) => {
    setTransferModalStudent(student)
    setTargetTeacherId('')
  }

  const handleConfirmTransfer = async () => {
    if (!transferModalStudent || !targetTeacherId) return
    setTransferring(true)
    try {
      const { error } = await supabase.rpc('transfer_student', {
        target_student_id: transferModalStudent.id,
        new_teacher_id: targetTeacherId
      })
      if (error) throw error

      const newTeacher = teachersOverview.find(t => t.teacher_id === targetTeacherId) || allTeachers.find(t => t.teacher_id === targetTeacherId)

      fetch('/api/admin/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer_student',
          entityType: 'student',
          entityId: transferModalStudent.id,
          description: `Memindahkan murid ${transferModalStudent.name} ke ${newTeacher?.name || 'guru baru'}`,
          details: {
            studentId: transferModalStudent.id,
            studentName: transferModalStudent.name,
            targetTeacherId,
            targetTeacherName: newTeacher?.name
          }
        })
      }).catch(console.error)

      triggerToast('success', locale === 'id' 
        ? `Murid ${transferModalStudent.name}, riwayat laporan, dan masukan orang tua berhasil dipindahkan ke ${newTeacher?.name || 'guru baru'}.`
        : `Student ${transferModalStudent.name}, reports, and parent feedbacks successfully transferred to ${newTeacher?.name || 'new teacher'}.`
      )
      setTransferModalStudent(null)
      setTargetTeacherId('')
      await fetchData()
    } catch (err: any) {
      triggerToast('error', err.message || 'Gagal memindahkan murid.')
    } finally {
      setTransferring(false)
    }
  }

  const triggerToast = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMsg(message)
      setTimeout(() => setSuccessMsg(''), 4000)
    } else {
      setErrorMsg(message)
      setTimeout(() => setErrorMsg(''), 4000)
    }
  }

  // --- STUDENT ACTIONS ---
  const handleOpenStudentModal = (student: any | null = null) => {
    setEditingStudent(student)
    if (student) {
      setStudentName(student.name)
      setStudentSubject(student.subject)
      setStudentFirstMeeting(student.first_meeting_date || '')
      setStudentMeetingCount(student.meeting_count || 0)
      setStudentLanguage(resolveStudentLanguage(student, languageMap))
    } else {
      setStudentName('')
      setStudentSubject('')
      setStudentFirstMeeting('')
      setStudentMeetingCount(0)
      setStudentLanguage(locale === 'en' ? 'en' : 'id')
    }
    setShowStudentModal(true)
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')

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

      if (editingStudent) {
        // Edit student
        const payload: any = {
          name: studentName,
          subject: studentSubject,
          first_meeting_date: studentFirstMeeting || null,
          meeting_count: studentMeetingCount,
          language: studentLanguage
        }

        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id)

        if (error) {
          if (error.code === 'PGRST204') {
            // Column 'language' not found in schema cache yet -> update without it & save fallback
            delete payload.language
            const { error: retryErr } = await supabase
              .from('students')
              .update(payload)
              .eq('id', editingStudent.id)
            if (retryErr) throw retryErr
            await saveStudentLanguageFallback(editingStudent.id, studentLanguage, supabase)
          } else {
            throw error
          }
        } else {
          // In case column exists, also update fallback map in memory
          await saveStudentLanguageFallback(editingStudent.id, studentLanguage, supabase)
        }

        triggerToast('success', locale === 'id' ? 'Data murid berhasil diperbarui.' : 'Student data successfully updated.')
      } else {
        // Create student
        const targetOwnerId = (isAdmin && selectedTeacher) ? selectedTeacher.teacher_id : currentUserId
        const payload: any = {
          name: studentName,
          subject: studentSubject,
          first_meeting_date: studentFirstMeeting || null,
          meeting_count: studentMeetingCount,
          language: studentLanguage,
          user_id: targetOwnerId
        }

        const { data: inserted, error } = await supabase
          .from('students')
          .insert(payload)
          .select()
          .maybeSingle()

        if (error) {
          if (error.code === 'PGRST204') {
            delete payload.language
            const { data: fallbackInserted, error: retryErr } = await supabase
              .from('students')
              .insert(payload)
              .select()
              .maybeSingle()
            if (retryErr) throw retryErr
            if (fallbackInserted) {
              await saveStudentLanguageFallback(fallbackInserted.id, studentLanguage, supabase)
            }
          } else {
            throw error
          }
        } else if (inserted) {
          await saveStudentLanguageFallback(inserted.id, studentLanguage, supabase)
        }

        triggerToast('success', locale === 'id' ? 'Murid baru berhasil ditambahkan.' : 'New student successfully added.')
      }
      setShowStudentModal(false)
      fetchData()
    } catch (err: any) {
      triggerToast('error', err.message || 'Gagal menyimpan data murid.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStudent = (id: string) => {
    confirm({
      message: locale === 'id' 
        ? 'Apakah Anda yakin ingin menghapus murid ini? Riwayat laporan juga akan terpengaruh.' 
        : 'Are you sure you want to delete this student? Report history will also be affected.',
      onConfirm: async () => {
        const { error } = await supabase.from('students').delete().eq('id', id)
        if (error) throw error
        triggerToast('success', 'Murid berhasil dihapus.')
        fetchData()
      }
    })
  }

  // --- SHARE PORTAL ACTION ---
  const handleOpenShareModal = () => {
    const targetStudents = [...displayedStudents].sort((a, b) => a.name.localeCompare(b.name))

    if (targetStudents.length === 0) {
      setShareText(locale === 'id' ? 'Belum ada data murid.' : 'No student data yet.')
    } else {
      const hostUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const shareLines = targetStudents.map((s, idx) => {
        const slug = s.slug || slugify(s.name)
        return `${idx + 1}. ${s.name} : ${hostUrl}/p/${slug}.`
      })
      const text = `PORTAL ORTU\n${shareLines.join('\n')}`
      setShareText(text)
    }

    setShareCopied(false)
    setShowShareModal(true)
  }

  const handleCopyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text', err)
    }
  }

  // Filters
  const displayedStudents = (isAdmin && selectedTeacher)
    ? students.filter(s => s.user_id === selectedTeacher.teacher_id)
    : students

  const filteredStudents = displayedStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTeachers = teachersOverview.filter(t =>
    t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Primary Content Header */}
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          {isAdmin && selectedTeacher && (
            <button
              onClick={() => {
                setSelectedTeacher(null)
                setSearchQuery('')
              }}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-black hover:text-white text-black border border-black/10 transition-colors cursor-pointer flex items-center justify-center shadow-none"
              title={locale === 'id' ? 'Kembali ke Semua Guru' : 'Back to All Teachers'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">
            {isAdmin && !selectedTeacher
              ? (locale === 'id' ? 'Pengajar & Murid' : 'Teachers & Students')
              : (isAdmin && selectedTeacher
                  ? selectedTeacher.name
                  : t('students_title'))}
          </h2>
          <div className="h-4 w-px bg-black/10" />
          <span className="text-xs font-medium text-neutral-500 font-mono tracking-wider">
            {isAdmin && !selectedTeacher
              ? `${teachersOverview.length} ${locale === 'id' ? 'Pengajar Aktif' : 'Active Teachers'} • ${students.length} ${t('nav_students')}`
              : `${displayedStudents.length} ${t('nav_students')}`}
          </span>
        </div>

        {/* Action Buttons: Bagikan Portal & Tambah Murid */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenShareModal}
            className="bg-white border border-black/10 hover:bg-neutral-100 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
          >
            <Share2 className="w-4 h-4 text-neutral-500" />
            <span>{t('btn_share_portals')}</span>
          </button>

          <button
            onClick={() => handleOpenStudentModal()}
            className="bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>{locale === 'id' ? 'Tambah Murid' : 'Add Student'}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-white border border-black text-black text-xs px-4 py-3 rounded-2xl flex gap-2.5 shadow-none font-medium">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-black" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-white border border-black text-black text-xs px-4 py-3 rounded-2xl flex gap-2.5 shadow-none font-bold">
          <X className="w-4 h-4 mt-0.5 flex-shrink-0 text-black" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-black animate-spin" />
        </div>
      ) : (
        /* STUDENTS VIEW */
        isAdmin && !selectedTeacher ? (
          /* ADMIN TEACHER CARDS VIEW (3 Columns per Row) */
          <div className="space-y-6">
            <div className="bg-white border border-black/10 p-4 rounded-2xl shadow-none">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder={locale === 'id' ? 'Cari nama guru atau email...' : 'Search teacher name or email...'}
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="form-input-premium pl-10 shadow-none"
                />
              </div>
            </div>

            {filteredTeachers.length === 0 ? (
              <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
                <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                  {locale === 'id' ? 'Tidak Ada Pengajar Ditemukan' : 'No Teachers Found'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeachers.map((teacher) => (
                  <div
                    key={teacher.teacher_id}
                    onClick={() => {
                      setSelectedTeacher(teacher)
                      setSearchQuery('')
                    }}
                    className="bg-white border border-black/10 rounded-2xl p-6 hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer shadow-none hover:shadow-md flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-base text-black font-mono group-hover:bg-black group-hover:text-white transition-colors duration-350">
                          {teacher.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold font-mono bg-neutral-100 text-black border border-black/10">
                          {teacher.student_count} {locale === 'id' ? 'Murid' : 'Students'}
                        </span>
                      </div>

                      <h3 className="font-bold text-lg text-black group-hover:text-neutral-900 tracking-tight line-clamp-1">
                        {teacher.name}
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono line-clamp-1 mt-1">
                        {teacher.email}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-black/5 flex items-center justify-between text-xs font-bold font-mono uppercase tracking-wider text-neutral-600 group-hover:text-black">
                      <span>{locale === 'id' ? 'Kelola Murid' : 'Manage Students'}</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back Navigation Bar for Admin */}
            {isAdmin && selectedTeacher && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-black/10 rounded-2xl p-3.5">
                <button
                  onClick={() => {
                    setSelectedTeacher(null)
                    setSearchQuery('')
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-black/15 hover:bg-black hover:text-white text-black text-xs font-bold uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group shadow-none"
                >
                  <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                  <span>{locale === 'id' ? 'Kembali ke Semua Guru' : 'Back to All Teachers'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 font-mono">{locale === 'id' ? 'Pengajar Terpilih:' : 'Selected Teacher:'}</span>
                  <span className="text-xs font-bold text-black font-mono bg-white px-3 py-1.5 rounded-xl border border-black/10">
                    {selectedTeacher.name} • {displayedStudents.length} {locale === 'id' ? 'Murid' : 'Students'}
                  </span>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder={t('placeholder_search_student')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input-premium pl-10 shadow-none"
              />
            </div>

            {filteredStudents.length === 0 ? (
              <div className="border border-dashed border-black/10 bg-white rounded-2xl p-12 text-center text-neutral-400 shadow-none">
                <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="font-bold text-sm text-black font-mono uppercase tracking-wider">
                  {locale === 'id' ? 'Belum Ada Data Murid' : 'No Student Data Yet'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {locale === 'id' 
                    ? 'Silakan klik tombol Tambah Murid untuk mendaftarkan murid baru.' 
                    : 'Please click the Add Student button to register a new student.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-neutral-50 font-mono">
                      <th className="p-4">{t('label_student_name')}</th>
                      <th className="p-4">{t('label_student_subject')}</th>
                      <th className="p-4">{locale === 'id' ? 'Bahasa Laporan' : 'Language'}</th>
                      <th className="p-4">{locale === 'id' ? 'Tanggal Mulai' : 'Start Date'}</th>
                      <th className="p-4 text-center">{t('label_student_meet_count')}</th>
                      <th className="p-4 text-right">{locale === 'id' ? 'Aksi' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-sm text-neutral-700">
                    {filteredStudents.map((s) => {
                      const effectiveLang = resolveStudentLanguage(s, languageMap)
                      return (
                        <tr key={s.id} className="hover:bg-neutral-50/50 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]">
                          <td className="p-4 font-bold text-black">{s.name}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 border border-black/5 text-black text-xs font-semibold rounded-xl font-mono uppercase">
                              <BookOpen className="w-3.5 h-3.5" />
                              {s.subject}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs font-bold rounded-xl font-mono uppercase ${
                              effectiveLang === 'en'
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-100 text-neutral-800 border-black/10'
                            }`}>
                              <span>{effectiveLang === 'en' ? '🇬🇧 English' : '🇮🇩 Indonesia'}</span>
                            </span>
                          </td>
                          <td className="p-4 text-neutral-500 font-mono text-xs">{s.first_meeting_date || '-'}</td>
                          <td className="p-4 text-center font-bold text-black font-mono">{s.meeting_count || 0}</td>
                          <td className="p-4 text-right space-x-1.5">
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenTransferModal(s)}
                              className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                              title={locale === 'id' ? 'Pindahkan Murid ke Guru Lain' : 'Transfer Student to Another Teacher'}
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenStudentModal(s)}
                            className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            title={t('btn_edit')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id)}
                            className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer font-bold"
                            title={t('btn_delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* STUDENT MODAL */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 shadow-none relative">
            <button 
              onClick={() => setShowStudentModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-black mb-6 uppercase tracking-wider font-mono">
              {editingStudent 
                ? (locale === 'id' ? 'Edit Data Murid' : 'Edit Student Details') 
                : (locale === 'id' ? 'Tambah Murid Baru' : 'Add New Student')}
            </h3>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                  {t('label_student_name')}
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Contoh: Renziro"
                  className="form-input-premium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                  {t('label_student_subject')}
                </label>
                <input
                  type="text"
                  required
                  value={studentSubject}
                  onChange={(e) => setStudentSubject(e.target.value)}
                  placeholder="Contoh: Scratch Level 1"
                  className="form-input-premium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {t('label_student_first_meet')}
                  </label>
                  <CustomDatePicker
                    value={studentFirstMeeting}
                    onChange={(val) => setStudentFirstMeeting(val)}
                    placeholder="Pilih Tanggal Pertama"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {t('label_student_meet_count')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={studentMeetingCount}
                    onChange={(e) => setStudentMeetingCount(Number(e.target.value))}
                    className="form-input-premium"
                  />
                </div>
              </div>

              {/* Language Selector in Student Modal */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{locale === 'id' ? 'Bahasa Laporan' : 'Report Language'}</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {locale === 'id' ? 'Auto-bind di buat laporan' : 'Auto-bind on report creation'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentLanguage('id')}
                    className={`py-2.5 px-3 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      studentLanguage === 'id'
                        ? 'bg-black text-white border-black shadow-xs scale-[1.01]'
                        : 'bg-neutral-50 text-neutral-600 border-black/10 hover:border-black/30 hover:bg-neutral-100'
                    }`}
                  >
                    <span>🇮🇩</span>
                    <span>Bahasa Indonesia (ID)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentLanguage('en')}
                    className={`py-2.5 px-3 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      studentLanguage === 'en'
                        ? 'bg-black text-white border-black shadow-xs scale-[1.01]'
                        : 'bg-neutral-50 text-neutral-600 border-black/10 hover:border-black/30 hover:bg-neutral-100'
                    }`}
                  >
                    <span>🇬🇧</span>
                    <span>English (EN)</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('btn_save_data')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE PORTAL MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 shadow-none relative animate-scale-up">
            <button 
              onClick={() => setShowShareModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-black mb-2 uppercase tracking-wider font-mono">
              {t('modal_share_title')}
            </h3>
            
            <p className="text-xs text-neutral-500 mb-4">
              {t('modal_share_desc')}
            </p>

            <div className="space-y-4">
              <div>
                <textarea
                  rows={10}
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  className="w-full bg-neutral-50 border border-black/10 rounded-xl p-4 text-xs text-black font-mono leading-relaxed focus:outline-none focus:border-black focus:shadow-[0_0_0_1px_#000000] resize-y"
                />
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono order-3 sm:order-1"
                >
                  {t('btn_cancel')}
                </button>
                
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="bg-white border border-black hover:bg-neutral-50 text-black font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono order-2"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-4 h-4 text-black animate-pulse" />
                      <span>{t('btn_copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-black" />
                      <span>{locale === 'id' ? 'Salin Teks' : 'Copy Text'}</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black hover:bg-neutral-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono order-1 sm:order-3 text-center"
                >
                  <span>{t('btn_share_wa')}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER STUDENT MODAL */}
      {transferModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-black/10 rounded-2xl p-6 shadow-xl relative animate-scale-up">
            <button 
              onClick={() => {
                setTransferModalStudent(null)
                setTargetTeacherId('')
              }}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-black/10 flex items-center justify-center text-black">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black uppercase tracking-wider font-mono">
                  {locale === 'id' ? 'Pindahkan Murid' : 'Transfer Student'}
                </h3>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {locale === 'id' ? 'Alihkan murid & riwayat ke guru lain' : 'Reassign student & history to another teacher'}
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 border border-black/10 rounded-xl p-3.5 my-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-black font-mono">{transferModalStudent.name}</span>
                <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 bg-neutral-200 text-neutral-800 rounded">
                  {transferModalStudent.subject}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                {locale === 'id' ? 'Jumlah Pertemuan:' : 'Meeting Count:'} {transferModalStudent.meeting_count || 0}
              </p>
              <p className="text-[10px] text-neutral-400 leading-relaxed italic pt-1 border-t border-black/5">
                {locale === 'id' 
                  ? 'Catatan: Seluruh laporan pembelajaran terdahulu murid ini juga akan dipindahkan ke guru baru.'
                  : 'Note: All previous lesson reports for this student will also be transferred to the new teacher.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                  {locale === 'id' ? 'Pilih Guru Tujuan' : 'Select Target Teacher'}
                </label>
                {teachersOverview.filter(t => t.teacher_id !== transferModalStudent.user_id).length === 0 ? (
                  <div className="p-3 bg-neutral-100 border border-black/10 rounded-xl text-neutral-500 text-xs font-mono">
                    {locale === 'id' 
                      ? 'Tidak ada guru aktif lain yang tersedia untuk tujuan pemindahan.' 
                      : 'No other active teachers available for transfer.'}
                  </div>
                ) : (
                  <CustomSelect
                    options={teachersOverview
                      .filter(t => t.teacher_id !== transferModalStudent.user_id)
                      .map(t => ({
                        value: t.teacher_id,
                        label: t.name
                      }))}
                    value={targetTeacherId}
                    onChange={(val) => setTargetTeacherId(val)}
                    placeholder={locale === 'id' ? 'Pilih nama guru...' : 'Select teacher name...'}
                    isSearchable={true}
                  />
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalStudent(null)
                    setTargetTeacherId('')
                  }}
                  className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="button"
                  disabled={!targetTeacherId || transferring}
                  onClick={handleConfirmTransfer}
                  className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {transferring && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{locale === 'id' ? 'Konfirmasi Pindah' : 'Confirm Transfer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
