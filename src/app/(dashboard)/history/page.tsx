'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { compressImage } from '@/lib/imageCompressor'
import CustomSelect from '@/components/CustomSelect'
import { useTranslation } from '@/components/LocaleProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { getCachedData, setCachedData } from '@/lib/dataCache'
import {
  History,
  Search,
  Copy,
  Trash2,
  Edit2,
  Check,
  Loader2,
  X,
  User,
  Calendar,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Eye,
  Share2,
  Clock,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'

import { getRelativeTime } from '@/lib/dateUtils'
import { slugify } from '@/lib/slug'

const getStudentSlug = slugify

export default function HistoryPage() {
  const supabase = createClient()
  const { t, locale } = useTranslation()
  const { confirm } = useConfirm()
  const [userId, setUserId] = useState<string | null>(null)

  const cachedReports = getCachedData<any[]>('history_reports')
  const cachedStudents = getCachedData<any[]>('history_students')
  const cachedOverview = getCachedData<any[]>('history_teachers_overview')

  // Admin & Teacher View States
  const [isAdmin, setIsAdmin] = useState(false)
  const [teachersOverview, setTeachersOverview] = useState<any[]>(cachedOverview || [])
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null)
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('')

  // Data States
  const [reports, setReports] = useState<any[]>(cachedReports || [])
  const [students, setStudents] = useState<any[]>(cachedStudents || [])
  const [loading, setLoading] = useState(!cachedReports && !cachedOverview)

  // Period Filter State (Default: 'this_week')
  const [selectedPeriod, setSelectedPeriod] = useState<'this_week' | 'this_month' | 'last_month' | 'all_time'>('this_week')

  // Lazy Loaded Details Cache (content & behavior)
  const [reportDetailsCache, setReportDetailsCache] = useState<Record<string, { content: string; behavior: string }>>({})
  const [loadingReportDetails, setLoadingReportDetails] = useState<Record<string, boolean>>({})

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('all')
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent')

  // Copy State Tracker
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null)
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null)

  // Expanded States
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({})

  // Edit Form States
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingReport, setEditingReport] = useState<any | null>(null)
  const [editMeetingNumber, setEditMeetingNumber] = useState<number>(1)
  const [editReportDate, setEditReportDate] = useState('')
  const [editMateri, setEditMateri] = useState('')
  const [editBehavior, setEditBehavior] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editImage, setEditImage] = useState<File | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [updating, setUpdating] = useState(false)

  // Status Alerts
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Storage Cleanup Helper
  const deleteStorageFile = async (imageUrl: string) => {
    try {
      if (!imageUrl || !imageUrl.includes('/reports/')) return
      const parts = imageUrl.split('/reports/')
      if (parts.length < 2) return
      const filePath = decodeURIComponent(parts[1].split('?')[0])
      if (filePath) {
        await supabase.storage.from('reports').remove([filePath])
      }
    } catch (err) {
      console.warn('Failed to delete storage file:', err)
    }
  }

  // Calculate Period Date Boundaries
  const getPeriodDateRange = (period: 'this_week' | 'this_month' | 'last_month' | 'all_time') => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()

    if (period === 'this_week') {
      const day = now.getDay()
      const diffToMonday = day === 0 ? 6 : day - 1
      const monday = new Date(y, m, d - diffToMonday)
      const startDate = monday.toISOString().split('T')[0]
      return { startDate, endDate: null }
    } else if (period === 'this_month') {
      const startOfMonth = new Date(y, m, 1)
      const startDate = startOfMonth.toISOString().split('T')[0]
      return { startDate, endDate: null }
    } else if (period === 'last_month') {
      const startOfLastMonth = new Date(y, m - 1, 1)
      const endOfLastMonth = new Date(y, m, 0)
      const startDate = startOfLastMonth.toISOString().split('T')[0]
      const endDate = endOfLastMonth.toISOString().split('T')[0]
      return { startDate, endDate }
    }
    return { startDate: null, endDate: null }
  }

  // Core Data Fetcher for a given teacher and period
  const fetchReportsForTarget = async (targetTeacherId: string, period = selectedPeriod) => {
    if (!reports.length) {
      setLoading(true)
    }
    try {
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, slug')
        .eq('user_id', targetTeacherId)
        .is('deleted_at', null)
      if (studentsData) {
        setStudents(studentsData)
        setCachedData('history_students', studentsData)
      }

      // Lightweight initial query: excludes heavy content & behavior columns
      let query = supabase
        .from('reports')
        .select('id, student_id, student_name, subject, meeting_number, report_date, materi, image_url, created_at, updated_at, user_id')
        .eq('user_id', targetTeacherId)
        .is('deleted_at', null)

      const { startDate, endDate } = getPeriodDateRange(period)
      if (startDate) {
        query = query.gte('report_date', startDate)
      }
      if (endDate) {
        query = query.lte('report_date', endDate)
      }

      const { data: reportsData } = await query
        .order('report_date', { ascending: false })
        .order('meeting_number', { ascending: false })

      if (reportsData) {
        setReports(reportsData)
        setCachedData('history_reports', reportsData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = (newPeriod: string) => {
    const period = newPeriod as 'this_week' | 'this_month' | 'last_month' | 'all_time'
    setSelectedPeriod(period)
    const activeTargetId = isAdmin ? selectedTeacher?.teacher_id : userId
    if (activeTargetId) {
      fetchReportsForTarget(activeTargetId, period)
    }
  }

  const handleSelectTeacher = (teacher: any) => {
    setSelectedTeacher(teacher)
    setSearchQuery('')
    setSelectedStudentId('all')
    fetchReportsForTarget(teacher.teacher_id, selectedPeriod)
  }

  const handleBackToTeachers = () => {
    setSelectedTeacher(null)
    setReports([])
    setStudents([])
    setSearchQuery('')
    setSelectedStudentId('all')
    fetchData()
  }

  const fetchData = async () => {
    if (!reports.length && !teachersOverview.length) {
      setLoading(true)
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const userIsAdmin = user.app_metadata?.role === 'admin'
        setIsAdmin(userIsAdmin)

        if (userIsAdmin) {
          // Admin: fetch lightweight teacher cards overview with report count
          const { data: overview } = await supabase.rpc('get_history_teachers_overview')
          if (overview) {
            setTeachersOverview(overview)
            setCachedData('history_teachers_overview', overview)
          }
          setReports([])
          setStudents([])
        } else {
          // Regular teacher: fetch lightweight reports for current period
          await fetchReportsForTarget(user.id, selectedPeriod)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(''), 4000)
    } else {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 4000)
    }
  }

  // Two-Stage Lazy Loading on Report Expansion
  const toggleReportExpand = async (reportId: string) => {
    const isCurrentlyExpanded = !expandedReports[reportId]
    setExpandedReports(prev => ({
      ...prev,
      [reportId]: isCurrentlyExpanded
    }))

    // If expanding and details not yet cached, fetch content & behavior on-demand
    if (isCurrentlyExpanded && !reportDetailsCache[reportId]) {
      setLoadingReportDetails(prev => ({ ...prev, [reportId]: true }))
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('content, behavior')
          .eq('id', reportId)
          .single()

        if (data && !error) {
          setReportDetailsCache(prev => ({
            ...prev,
            [reportId]: {
              content: data.content || '',
              behavior: data.behavior || ''
            }
          }))
        }
      } catch (err) {
        console.error('Failed to load report detail:', err)
      } finally {
        setLoadingReportDetails(prev => ({ ...prev, [reportId]: false }))
      }
    }
  }

  const toggleStudentExpand = (studentId: string) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }))
  }

  const handleCopyText = async (id: string) => {
    let text = reportDetailsCache[id]?.content
    if (!text) {
      setCopiedId(id)
      const { data } = await supabase
        .from('reports')
        .select('content, behavior')
        .eq('id', id)
        .single()
      if (data) {
        text = data.content || ''
        setReportDetailsCache(prev => ({
          ...prev,
          [id]: { content: text || '', behavior: data.behavior || '' }
        }))
      }
    }
    if (text) {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleShareLink = (studentName: string, studentId: string) => {
    const student = students.find(s => s.id === studentId)
    const slug = student?.slug || getStudentSlug(studentName)
    const url = `${window.location.origin}/p/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedStudentId(studentId)
    setTimeout(() => setCopiedStudentId(null), 2000)
    triggerToast('success', locale === 'id' ? 'Link portal orang tua berhasil disalin!' : 'Parent portal link copied successfully!')
  }

  const handleShareCategoryPortals = (group: any) => {
    if (!group.studentGroups || group.studentGroups.length === 0) return

    const lines = [locale === 'id' ? 'LAPORAN TERBARU:' : 'UPDATED REPORTS:']
    group.studentGroups.forEach((studentGroup: any, index: number) => {
      const student = students.find(s => s.id === studentGroup.studentId)
      const slug = student?.slug || getStudentSlug(studentGroup.studentName)
      const url = `${window.location.origin}/p/${slug}`
      lines.push(`${index + 1}. ${studentGroup.studentName} : ${url}`)
    })

    const textToCopy = lines.join('\n')
    navigator.clipboard.writeText(textToCopy)
    
    setCopiedGroupId(group.titleId)
    setTimeout(() => setCopiedGroupId(null), 2000)

    triggerToast(
      'success',
      locale === 'id'
        ? 'Daftar portal orang tua berhasil disalin!'
        : 'Parent portal list copied successfully!'
    )
  }

  const handleDeleteReport = (id: string, studentId: string) => {
    confirm({
      message: locale === 'id' 
        ? 'Apakah Anda yakin ingin menghapus laporan ini dari riwayat?' 
        : 'Are you sure you want to delete this report from history?',
      onConfirm: async () => {
        const reportToDelete = reports.find(r => r.id === id)
        const { error } = await supabase.from('reports').delete().eq('id', id)
        if (error) throw error

        if (reportToDelete?.image_url) {
          await deleteStorageFile(reportToDelete.image_url)
        }

        // Recalculate meeting_count for the student
        const { count: reportsCount } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .is('deleted_at', null)

        await supabase.from('students')
          .update({ meeting_count: reportsCount || 0 })
          .eq('id', studentId)

        fetch('/api/admin/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_report',
            entityType: 'report',
            entityId: id,
            description: `Menghapus laporan riwayat murid ${reportToDelete?.student_name || studentId} (Pertemuan ${reportToDelete?.meeting_number || '-'})`,
            details: {
              reportId: id,
              studentId,
              studentName: reportToDelete?.student_name,
              meetingNumber: reportToDelete?.meeting_number,
              topic: reportToDelete?.topic
            }
          })
        }).catch(console.error)

        triggerToast('success', locale === 'id' ? 'Laporan berhasil dihapus.' : 'Report deleted successfully.')
        const activeTargetId = isAdmin ? selectedTeacher?.teacher_id : userId
        if (activeTargetId) {
          await fetchReportsForTarget(activeTargetId, selectedPeriod)
        }
      }
    })
  }

  const handleOpenEditModal = async (report: any) => {
    setEditingReport(report)
    setEditMeetingNumber(report.meeting_number)
    setEditReportDate(report.report_date)
    setEditMateri(report.materi)
    setEditImage(null)
    if (editFileInputRef.current) editFileInputRef.current.value = ''

    // Populate behavior and content (from cache or lazy fetch)
    if (reportDetailsCache[report.id]) {
      setEditBehavior(reportDetailsCache[report.id].behavior)
      setEditContent(reportDetailsCache[report.id].content)
    } else {
      setEditBehavior('')
      setEditContent('')
      const { data } = await supabase
        .from('reports')
        .select('content, behavior')
        .eq('id', report.id)
        .single()
      if (data) {
        setEditBehavior(data.behavior || '')
        setEditContent(data.content || '')
        setReportDetailsCache(prev => ({
          ...prev,
          [report.id]: { content: data.content || '', behavior: data.behavior || '' }
        }))
      }
    }
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReport) return
    setUpdating(true)

    try {
      let imageUrl = editingReport.image_url

      // If new image is uploaded, remove previous file to prevent bucket leak
      if (editImage) {
        if (editingReport.image_url) {
          await deleteStorageFile(editingReport.image_url)
        }

        const fileToUpload = await compressImage(editImage)
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
        const fileName = `${editingReport.student_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('reports')
          .upload(fileName, fileToUpload, {
            cacheControl: '2592000', // 30 hari cache
            upsert: false
          })

        if (uploadErr) {
          throw new Error('Gagal mengunggah foto baru: ' + uploadErr.message)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('reports')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      // Update Report Row
      const { error } = await supabase
        .from('reports')
        .update({
          meeting_number: editMeetingNumber,
          report_date: editReportDate,
          materi: editMateri,
          behavior: editBehavior,
          content: editContent,
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingReport.id)

      if (error) throw error

      // Update cache
      setReportDetailsCache(prev => ({
        ...prev,
        [editingReport.id]: {
          content: editContent,
          behavior: editBehavior
        }
      }))

      triggerToast('success', locale === 'id' ? 'Laporan berhasil diperbarui.' : 'Report updated successfully.')
      setShowEditModal(false)

      const activeTargetId = isAdmin ? selectedTeacher?.teacher_id : userId
      if (activeTargetId) {
        await fetchReportsForTarget(activeTargetId, selectedPeriod)
      }
    } catch (err: any) {
      triggerToast('error', err.message || 'Gagal memperbarui laporan.')
    } finally {
      setUpdating(false)
    }
  }

  // Teacher Filter for Admin Cards View
  const filteredTeachers = teachersOverview.filter(t =>
    t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())
  )

  // Frontend Filter for Active Report List
  const filteredReports = reports.filter(r => {
    const matchStudent = selectedStudentId === 'all' || r.student_id === selectedStudentId
    const text = (r.student_name + ' ' + r.subject + ' ' + r.materi).toLowerCase()
    const matchSearch = text.includes(searchQuery.toLowerCase())
    return matchStudent && matchSearch
  })

  // Group filtered reports by student
  const groupedReports: Record<string, {
    studentId: string,
    studentName: string,
    subject: string,
    reports: any[],
    relativeTime?: string,
    lastModifiedTime?: number
  }> = {}

  filteredReports.forEach(r => {
    const groupKey = r.student_id || `student_${r.student_name}`
    if (!groupedReports[groupKey]) {
      groupedReports[groupKey] = {
        studentId: r.student_id || '',
        studentName: r.student_name,
        subject: r.subject,
        reports: []
      }
    }
    groupedReports[groupKey].reports.push(r)
  })

  const groupedList = Object.values(groupedReports)

  // Sort reports within each student group and calculate modified times based on report_date
  groupedList.forEach(group => {
    group.reports.sort((a, b) => b.meeting_number - a.meeting_number)

    let maxTimestamp = 0
    let latestReportDate = ''
    group.reports.forEach(r => {
      const t = r.report_date || r.created_at
      const time = new Date(t).getTime()
      if (time > maxTimestamp) {
        maxTimestamp = time
        latestReportDate = t
      }
    })
    group.lastModifiedTime = maxTimestamp
    if (latestReportDate) {
      group.relativeTime = getRelativeTime(latestReportDate, locale)
    }
  })

  // Group student groups by timeline categories based on report_date
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  const getDayDiffFromTimestamp = (timestamp: number) => {
    if (!timestamp) return 999
    const date = new Date(timestamp)
    const reportStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    return Math.floor((todayStart - reportStart) / oneDayMs)
  }

  const timelineGroups = [
    { titleId: 'Hari Ini', titleEn: 'Today', studentGroups: [] as typeof groupedList },
    { titleId: 'Kemarin', titleEn: 'Yesterday', studentGroups: [] as typeof groupedList },
    { titleId: 'Minggu Ini', titleEn: 'This Week', studentGroups: [] as typeof groupedList },
    { titleId: 'Bulan Ini', titleEn: 'This Month', studentGroups: [] as typeof groupedList },
    { titleId: 'Sebelumnya', titleEn: 'Older', studentGroups: [] as typeof groupedList }
  ]

  groupedList.forEach(group => {
    const dayDiff = getDayDiffFromTimestamp(group.lastModifiedTime || 0)
    if (dayDiff <= 0) {
      timelineGroups[0].studentGroups.push(group)
    } else if (dayDiff === 1) {
      timelineGroups[1].studentGroups.push(group)
    } else if (dayDiff > 1 && dayDiff <= 7) {
      timelineGroups[2].studentGroups.push(group)
    } else if (dayDiff > 7 && dayDiff <= 30) {
      timelineGroups[3].studentGroups.push(group)
    } else {
      timelineGroups[4].studentGroups.push(group)
    }
  })

  // Sort student groups within each timeline category
  timelineGroups.forEach(tg => {
    tg.studentGroups.sort((a, b) => {
      const timeA = a.lastModifiedTime || 0
      const timeB = b.lastModifiedTime || 0
      if (sortOrder === 'recent') {
        return timeB - timeA
      } else {
        return timeA - timeB
      }
    })
  })

  const sortedTimeline = sortOrder === 'recent' ? timelineGroups : [...timelineGroups].reverse()
  const visibleTimeline = sortedTimeline.filter(tg => tg.studentGroups.length > 0)

  const studentFilterOptions = [
    { value: 'all', label: locale === 'id' ? 'Semua Murid' : 'All Students' },
    ...students.map(s => ({ value: s.id, label: s.name }))
  ]

  const periodOptions = [
    { value: 'this_week', label: locale === 'id' ? 'Minggu Ini' : 'This Week' },
    { value: 'this_month', label: locale === 'id' ? 'Bulan Ini' : 'This Month' },
    { value: 'last_month', label: locale === 'id' ? 'Bulan Lalu' : 'Last Month' },
    { value: 'all_time', label: locale === 'id' ? 'Semua Waktu' : 'All Time' }
  ]

  const sortOptions = [
    { value: 'recent', label: locale === 'id' ? 'Terbaru (Recent)' : 'Most Recent' },
    { value: 'oldest', label: locale === 'id' ? 'Terlama (Oldest)' : 'Oldest' }
  ]

  return (
    <div className="space-y-6">
      {/* Primary Content Header */}
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          {isAdmin && selectedTeacher && (
            <button
              onClick={handleBackToTeachers}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-black hover:text-white text-black border border-black/10 transition-colors cursor-pointer flex items-center justify-center shadow-none"
              title={locale === 'id' ? 'Kembali ke Semua Guru' : 'Back to All Teachers'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">
            {isAdmin && !selectedTeacher
              ? (locale === 'id' ? 'Riwayat per Pengajar' : 'History by Teacher')
              : (isAdmin && selectedTeacher
                  ? selectedTeacher.name
                  : t('history_title'))}
          </h2>
          <div className="h-4 w-px bg-black/10" />
          <span className="text-xs font-medium text-neutral-500 font-mono tracking-wider">
            {isAdmin && !selectedTeacher
              ? `${teachersOverview.length} ${locale === 'id' ? 'Pengajar' : 'Teachers'}`
              : `${reports.length} ${locale === 'id' ? 'Laporan' : 'Reports'}`}
          </span>
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

      {/* ADMIN TEACHER CARDS VIEW */}
      {isAdmin && !selectedTeacher ? (
        <div className="space-y-6">
          {/* Search Teacher Bar */}
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

          {loading ? (
            <div className="h-64 flex justify-center items-center">
              <Loader2 className="w-6 h-6 text-black animate-spin" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
              <History className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                {locale === 'id' ? 'Tidak Ada Pengajar Ditemukan' : 'No Teachers Found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeachers.map((teacher) => (
                <div
                  key={teacher.teacher_id}
                  onClick={() => handleSelectTeacher(teacher)}
                  className="bg-white border border-black/10 rounded-2xl p-6 hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer shadow-none hover:shadow-md flex flex-col justify-between group relative overflow-hidden"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-base text-black font-mono group-hover:bg-black group-hover:text-white transition-colors duration-350">
                        {teacher.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-neutral-100 text-black border border-black/10">
                          {teacher.report_count} {locale === 'id' ? 'Laporan' : 'Reports'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-neutral-50 text-neutral-600 border border-black/5">
                          {teacher.student_count} {locale === 'id' ? 'Murid' : 'Students'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-lg text-black group-hover:text-neutral-900 tracking-tight line-clamp-1">
                      {teacher.name}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono line-clamp-1 mt-1">
                      {teacher.email}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-black/5 flex items-center justify-between text-xs font-bold font-mono uppercase tracking-wider text-neutral-600 group-hover:text-black">
                    <span>{locale === 'id' ? 'Buka Riwayat Laporan' : 'View Report History'}</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TEACHER REPORT LIST (Regular Teacher View OR Admin Selected Teacher View) */
        <div className="space-y-6">
          {/* Back Navigation Bar for Admin */}
          {isAdmin && selectedTeacher && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-black/10 rounded-2xl p-3.5">
              <button
                onClick={handleBackToTeachers}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-black/15 hover:bg-black hover:text-white text-black text-xs font-bold uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group shadow-none"
              >
                <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                <span>{locale === 'id' ? 'Kembali ke Semua Guru' : 'Back to All Teachers'}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-mono">{locale === 'id' ? 'Pengajar Terpilih:' : 'Selected Teacher:'}</span>
                <span className="text-xs font-bold text-black font-mono bg-white px-3 py-1.5 rounded-xl border border-black/10">
                  {selectedTeacher.name} • {reports.length} {locale === 'id' ? 'Laporan' : 'Reports'}
                </span>
              </div>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="bg-white border border-black/10 p-4 rounded-2xl shadow-none flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder={t('placeholder_search_history')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input-premium pl-10 shadow-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Period Filter Dropdown (Default: This Week) */}
              <div className="relative w-full sm:w-[170px]">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 z-10 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </div>
                <CustomSelect
                  options={periodOptions}
                  value={selectedPeriod}
                  onChange={handlePeriodChange}
                  placeholder={locale === 'id' ? 'Periode' : 'Period'}
                  isSearchable={false}
                  className="pl-10"
                />
              </div>

              {/* Student Filter Dropdown */}
              <div className="relative w-full sm:w-[190px]">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 z-10 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <CustomSelect
                  options={studentFilterOptions}
                  value={selectedStudentId}
                  onChange={setSelectedStudentId}
                  placeholder="Semua Murid"
                  className="pl-10"
                />
              </div>

              {/* Sort Order Selector */}
              <div className="relative w-full sm:w-[160px]">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 z-10 pointer-events-none">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <CustomSelect
                  options={sortOptions}
                  value={sortOrder}
                  onChange={(val) => setSortOrder(val as any)}
                  placeholder={locale === 'id' ? 'Urutkan' : 'Sort By'}
                  isSearchable={false}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex justify-center items-center">
              <Loader2 className="w-6 h-6 text-black animate-spin" />
            </div>
          ) : visibleTimeline.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
              <History className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                {selectedPeriod === 'this_week'
                  ? (locale === 'id' ? 'Belum Ada Laporan Minggu Ini' : 'No Reports for This Week')
                  : (locale === 'id' ? 'Tidak Ada Riwayat Laporan' : 'No Report History Found')}
              </p>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                {selectedPeriod === 'this_week'
                  ? (locale === 'id'
                      ? 'Belum ada sesi laporan yang dibuat minggu ini. Ubah periode ke "Bulan Ini" atau "Semua Waktu" untuk melihat riwayat terdahulu.'
                      : 'No lesson reports created this week. Switch period to "This Month" or "All Time" to view previous reports.')
                  : (locale === 'id'
                      ? 'Belum ada laporan yang sesuai dengan kriteria pencarian Anda.'
                      : 'No reports match your current search filters.')}
              </p>
              {selectedPeriod === 'this_week' && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={() => handlePeriodChange('this_month')}
                    className="px-3.5 py-1.5 rounded-xl border border-black/15 bg-neutral-100 hover:bg-black hover:text-white text-black text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {locale === 'id' ? 'Lihat Bulan Ini' : 'View This Month'}
                  </button>
                  <button
                    onClick={() => handlePeriodChange('all_time')}
                    className="px-3.5 py-1.5 rounded-xl border border-black/15 bg-white hover:bg-black hover:text-white text-black text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {locale === 'id' ? 'Lihat Semua Waktu' : 'View All Time'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {visibleTimeline.map((group) => {
                return (
                  <div key={group.titleId} className="space-y-4">
                    {/* Timeline Category Header */}
                    <div className="flex items-center gap-3 pt-4 first:pt-0">
                      <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono select-none">
                        {locale === 'id' ? group.titleId : group.titleEn}
                      </span>
                      
                      <button
                        onClick={() => handleShareCategoryPortals(group)}
                        className={`
                          px-2 py-0.5 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer h-6 font-mono uppercase tracking-wider select-none
                          ${copiedGroupId === group.titleId
                            ? 'bg-black border-black text-white'
                            : 'bg-white border-black/10 text-neutral-500 hover:text-black hover:bg-neutral-100'}
                        `}
                        title={locale === 'id' ? 'Salin Semua Link Portal' : 'Copy All Portal Links'}
                      >
                        {copiedGroupId === group.titleId ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                        <span>{copiedGroupId === group.titleId ? (locale === 'id' ? 'Disalin' : 'Copied') : (locale === 'id' ? 'Bagikan Portal' : 'Share Portal')}</span>
                      </button>

                      <div className="h-px bg-black/10 flex-1" />
                      <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase bg-neutral-100 px-2.5 py-0.5 rounded-lg border border-black/5 select-none">
                        {group.studentGroups.length} {locale === 'id' ? 'Murid' : 'Students'}
                      </span>
                    </div>

                    {/* Timeline Student Groups List (Accordions) */}
                    <div className="space-y-4">
                      {group.studentGroups.map((studentGroup) => {
                        const isExpanded = !!expandedStudents[studentGroup.studentId]
                        return (
                          <div
                            key={studentGroup.studentId}
                            className="bg-white border border-black/10 rounded-2xl shadow-none overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/20"
                          >
                            {/* Accordion Trigger (Student Header) */}
                            <div
                              onClick={() => toggleStudentExpand(studentGroup.studentId)}
                              className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] select-none"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 font-mono select-none">
                                  {studentGroup.studentName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-black text-sm truncate">{studentGroup.studentName}</h3>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-neutral-500 font-medium font-mono uppercase tracking-wider">{studentGroup.subject}</span>
                                    {studentGroup.relativeTime && (
                                      <>
                                        <span className="text-[10px] text-neutral-300 font-medium select-none">•</span>
                                        <span className="text-[10px] text-neutral-500 font-semibold font-mono flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-neutral-300" />
                                          {locale === 'id' ? 'diubah ' : 'modified '}{studentGroup.relativeTime}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleShareLink(studentGroup.studentName, studentGroup.studentId)
                                  }}
                                  className={`
                                    px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer h-7 font-mono uppercase tracking-wider
                                    ${copiedStudentId === studentGroup.studentId
                                      ? 'bg-black border-black text-white'
                                      : 'bg-white border-black/10 text-neutral-500 hover:text-black hover:bg-neutral-100'}
                                  `}
                                  title={locale === 'id' ? 'Salin Link Portal' : 'Copy Portal Link'}
                                >
                                  {copiedStudentId === studentGroup.studentId ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                                  <span>{copiedStudentId === studentGroup.studentId ? (locale === 'id' ? 'Disalin' : 'Copied') : (locale === 'id' ? 'Bagikan' : 'Share')}</span>
                                </button>
                                <span className="inline-flex items-center px-2.5 py-0.5 bg-neutral-100 border border-black/5 text-black text-xs font-bold rounded-xl font-mono uppercase select-none">
                                  {studentGroup.reports.length} {locale === 'id' ? 'Laporan' : 'Reports'}
                                </span>
                                <ChevronDown
                                  className={`w-5 h-5 text-neutral-400 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </div>

                            {/* Accordion Body (Report List for Student) */}
                            {isExpanded && (
                              <div className="border-t border-black/10 bg-neutral-50/30 divide-y divide-black/5">
                                {studentGroup.reports.map((report) => {
                                  const isReportExpanded = !!expandedReports[report.id]
                                  const cachedDetail = reportDetailsCache[report.id]
                                  const isDetailLoading = !!loadingReportDetails[report.id]

                                  return (
                                    <div key={report.id} className="p-4 space-y-4 bg-white first:pt-4 last:pb-4">
                                      {/* Report Row Header */}
                                      <div
                                        onClick={() => toggleReportExpand(report.id)}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer select-none"
                                      >
                                        <div className="flex items-center gap-3 min-w-0 flex-wrap">
                                          <span className="inline-flex items-center px-2.5 py-0.5 bg-black border border-transparent text-white text-xs font-bold rounded-xl font-mono shrink-0">
                                            {locale === 'id' ? 'Meet' : 'Meeting'} {report.meeting_number}
                                          </span>
                                          <span className="text-xs text-neutral-400 font-mono shrink-0 flex items-center gap-1 font-semibold">
                                            <Calendar className="w-3.5 h-3.5 text-neutral-300" />
                                            {report.report_date}
                                          </span>
                                          <span className="text-[10px] text-neutral-450 font-semibold font-mono flex items-center gap-1 shrink-0 bg-neutral-100/50 border border-black/5 px-2 py-0.5 rounded-lg">
                                            <Clock className="w-3 h-3 text-neutral-300" />
                                            {getRelativeTime(report.report_date || report.created_at, locale)}
                                          </span>
                                          <p className="text-xs text-neutral-700 font-semibold truncate max-w-xs md:max-w-md hidden sm:block">
                                            {report.behavior || report.materi || (locale === 'id' ? `Pertemuan #${report.meeting_number}` : `Meeting #${report.meeting_number}`)}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                          {/* Copy content button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCopyText(report.id)
                                            }}
                                            className={`
                                              px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer h-7 font-mono uppercase tracking-wider
                                              ${copiedId === report.id
                                                ? 'bg-white border-black text-black font-bold'
                                                : 'bg-white border-black/10 text-neutral-500 hover:text-black hover:bg-neutral-100'}
                                            `}
                                          >
                                            {copiedId === report.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            <span>{copiedId === report.id ? t('btn_copied') : (locale === 'id' ? 'Salin' : 'Copy')}</span>
                                          </button>

                                          {/* View detail button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleReportExpand(report.id)
                                            }}
                                            className={`p-1.5 rounded-xl transition-colors cursor-pointer border h-7 w-7 flex items-center justify-center shadow-none ${isReportExpanded
                                                ? 'bg-black text-white border-black'
                                                : 'bg-white text-neutral-500 border-black/10 hover:text-black hover:bg-neutral-100'
                                              }`}
                                            title={locale === 'id' ? 'Lihat Detail Laporan' : 'View Report Details'}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>

                                          {/* Edit button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleOpenEditModal(report)
                                            }}
                                            className="text-neutral-550 hover:text-black p-1.5 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer border border-black/10 bg-white h-7 w-7 flex items-center justify-center shadow-none"
                                            title={t('btn_edit')}
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>

                                          {/* Delete button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeleteReport(report.id, report.student_id)
                                            }}
                                            className="text-neutral-500 hover:text-black p-1.5 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer border border-black/10 bg-white h-7 w-7 flex items-center justify-center shadow-none font-bold"
                                            title={t('btn_delete')}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>

                                          <ChevronDown
                                            className={`w-4 h-4 text-neutral-400 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${isReportExpanded ? 'rotate-180' : ''}`}
                                          />
                                        </div>
                                      </div>

                                      {/* Mobile-only observation preview row */}
                                      <p className="text-xs text-neutral-700 font-semibold block sm:hidden cursor-pointer" onClick={() => toggleReportExpand(report.id)}>
                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 font-mono">
                                          {locale === 'id' ? 'Catatan/Observasi:' : 'Note/Observation:'}
                                        </span>
                                        {report.behavior || report.materi || `${report.subject} - Meet ${report.meeting_number}`}
                                      </p>

                                      {/* Expanded Details Box (Two-Stage Lazy Loaded) */}
                                      {isReportExpanded && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 bg-neutral-50/50 border border-black/5 rounded-2xl p-4.5 mt-2 transition-all">
                                          {/* Inputs details (1/3) */}
                                          <div className="space-y-3.5 text-xs font-medium">
                                            <div>
                                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-1 font-mono select-none">
                                                {locale === 'id' ? 'Materi Diajarkan:' : 'Lesson Taught:'}
                                              </span>
                                              <p className="text-black leading-relaxed font-mono whitespace-pre-wrap bg-white border border-black/10 p-3 rounded-xl shadow-none">{report.materi}</p>
                                            </div>
                                            <div>
                                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-1 font-mono select-none">
                                                {locale === 'id' ? 'Behavior & Observasi:' : 'Behavior & Observation:'}
                                              </span>
                                              {isDetailLoading ? (
                                                <div className="bg-white border border-black/10 p-3 rounded-xl flex items-center gap-2 text-neutral-400 text-xs font-mono">
                                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                                                  <span>{locale === 'id' ? 'Memuat observasi...' : 'Loading observation...'}</span>
                                                </div>
                                              ) : (
                                                <p className="text-black leading-relaxed font-mono whitespace-pre-wrap bg-white border border-black/10 p-3 rounded-xl shadow-none">
                                                  {cachedDetail?.behavior || '-'}
                                                </p>
                                              )}
                                            </div>
                                            {report.image_url && (
                                              <div>
                                                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 font-mono select-none">
                                                  {locale === 'id' ? 'Foto Progres:' : 'Progress Photo:'}
                                                </span>
                                                <a
                                                  href={report.image_url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="group relative block w-full max-w-[240px] aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-black/10 shadow-none cursor-pointer"
                                                >
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={report.image_url}
                                                    alt="Progress"
                                                    className="w-full h-full object-cover filter grayscale contrast-115 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                                                  />
                                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-medium gap-1 text-[10px] uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] select-none">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    {locale === 'id' ? 'Buka Gambar' : 'Open Image'}
                                                  </div>
                                                </a>
                                              </div>
                                            )}
                                          </div>

                                          {/* AI report output content (2/3) */}
                                          <div className="lg:col-span-2 bg-white border border-black/10 rounded-2xl p-5 relative shadow-none flex flex-col min-h-[200px]">
                                            <div className="absolute top-3.5 right-4 flex items-center gap-1.5 text-[9px] font-extrabold text-white uppercase tracking-widest bg-black px-2.5 py-1 rounded-xl font-mono select-none">
                                              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                              <span>{locale === 'id' ? 'Hasil Laporan' : 'Report Output'}</span>
                                            </div>
                                            {isDetailLoading ? (
                                              <div className="flex-1 flex flex-col items-center justify-center py-12 text-neutral-400 gap-2.5">
                                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                <span className="text-xs font-mono">{locale === 'id' ? 'Memuat teks laporan...' : 'Loading report text...'}</span>
                                              </div>
                                            ) : (
                                              <pre className="text-xs text-black leading-relaxed font-mono whitespace-pre-wrap max-h-72 overflow-y-auto pr-2 mt-4 flex-1">
                                                {cachedDetail?.content || '-'}
                                              </pre>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl bg-white border border-black/10 rounded-2xl p-6 shadow-none relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-black mb-6 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Edit2 className="w-4 h-4 text-black" />
              <span>{t('modal_edit_report')}</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Pertemuan Ke-' : 'Meeting Number'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editMeetingNumber}
                    onChange={(e) => setEditMeetingNumber(Number(e.target.value))}
                    className="form-input-premium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Tanggal Laporan' : 'Report Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editReportDate}
                    onChange={(e) => setEditReportDate(e.target.value)}
                    className="form-input-premium"
                  />
                </div>
              </div>



              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                  {locale === 'id' ? 'Behavior & Observasi' : 'Behavior & Observation'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={editBehavior}
                  onChange={(e) => setEditBehavior(e.target.value)}
                  className="form-textarea-premium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                  {locale === 'id' ? 'Konten Laporan Akhir (Final Draft)' : 'Final Report Draft Content'}
                </label>
                <textarea
                  required
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="form-textarea-premium font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                  <ImageIcon className="w-4 h-4 text-neutral-400" />
                  {locale === 'id' ? 'Ganti Foto Progres Baru (Opsional)' : 'Change to New Progress Photo (Optional)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={editFileInputRef}
                  onChange={(e) => setEditImage(e.target.files?.[0] || null)}
                  className="w-full bg-white border border-black/10 rounded-xl p-2.5 text-xs text-neutral-550 focus:outline-none file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
                >
                  {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{locale === 'id' ? 'Simpan Perubahan' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
