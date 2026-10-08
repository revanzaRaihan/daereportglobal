'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useTranslation } from '@/components/LocaleProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { 
  Users, 
  UserPlus, 
  Mail, 
  Copy, 
  Check, 
  RotateCcw, 
  Trash2, 
  Search, 
  Clock, 
  AlertCircle, 
  Loader2, 
  X,
  BookOpen,
  History,
  RefreshCw
} from 'lucide-react'
import { InstructorMember, PendingInvite } from '@/lib/instructorAuth'
import { AuditLogItem } from '@/lib/auditLogger'

export default function InstructorsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { locale } = useTranslation()
  const { confirm } = useConfirm()

  // Data states
  const [activeMembers, setActiveMembers] = useState<InstructorMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Search & tab states
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'audit'>('active')

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'teacher' | 'admin'>('teacher')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteSuccessLink, setInviteSuccessLink] = useState('')
  const [inviteError, setInviteError] = useState('')

  // Safe Deoffboarding states
  const [deoffboardingMember, setDeoffboardingMember] = useState<InstructorMember | null>(null)
  const [assignedStudents, setAssignedStudents] = useState<{ id: string; name: string; subject: string }[]>([])
  const [loadingAssignedStudents, setLoadingAssignedStudents] = useState(false)
  const [targetTransferTeacherId, setTargetTransferTeacherId] = useState('')
  const [deoffboardStep, setDeoffboardStep] = useState<'review' | 'transferring' | 'deleting'>('review')
  const [transferProgress, setTransferProgress] = useState<{ current: number; total: number } | null>(null)
  const [deoffboardError, setDeoffboardError] = useState('')

  // Toast / Action feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingEmail, setActionLoadingEmail] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(''), 4000)
    } else {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 4000)
    }
  }

  // Fetch overview data
  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)
      const userIsAdmin = user.app_metadata?.role === 'admin'
      setIsAdmin(userIsAdmin)

      if (!userIsAdmin) {
        router.push('/')
        return
      }

      const res = await fetch('/api/admin/instructors')
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat daftar instruktur.')
      }

      setActiveMembers(json.activeMembers || [])
      setPendingInvites(json.pendingInvites || [])
    } catch (err: any) {
      console.error(err)
      triggerToast('error', err.message || 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Send invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    setInviteSubmitting(true)

    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirimkan undangan.')
      }

      setInviteSuccessLink(data.actionLink || '')
      triggerToast('success', locale === 'id' 
        ? `Undangan aktivasi berhasil dikirim ke ${inviteEmail}.`
        : `Activation invite sent to ${inviteEmail}.`
      )
      await fetchData()
    } catch (err: any) {
      setInviteError(err.message || 'Gagal mengirim undangan.')
    } finally {
      setInviteSubmitting(false)
    }
  }

  // Resend invitation
  const handleResendInvite = async (email: string) => {
    setActionLoadingEmail(email)
    try {
      const res = await fetch('/api/admin/instructors/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ulang.')

      triggerToast('success', locale === 'id' 
        ? `Tautan aktivasi baru berhasil dikirim ulang ke ${email}.`
        : `Activation link resent to ${email}.`
      )
      await fetchData()
    } catch (err: any) {
      triggerToast('error', err.message || 'Gagal mengirim ulang.')
    } finally {
      setActionLoadingEmail(null)
    }
  }

  // Revoke invitation
  const handleRevokeInvite = (email: string) => {
    confirm({
      message: locale === 'id' 
        ? `Batalkan undangan aktivasi untuk ${email}?` 
        : `Revoke activation invite for ${email}?`,
      onConfirm: async () => {
        setActionLoadingEmail(email)
        try {
          const res = await fetch('/api/admin/instructors/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })

          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal membatalkan.')

          triggerToast('success', locale === 'id' ? 'Undangan berhasil dibatalkan.' : 'Invite revoked.')
          await fetchData()
        } catch (err: any) {
          triggerToast('error', err.message || 'Gagal membatalkan.')
        } finally {
          setActionLoadingEmail(null)
        }
      }
    })
  }

  // Safe Deoffboarding Handlers
  const handleStartDeoffboard = async (member: InstructorMember) => {
    if (member.id === currentUserId) {
      triggerToast('error', locale === 'id' ? 'Anda tidak dapat menghapus akun Anda sendiri.' : 'You cannot remove your own account.')
      return
    }

    setDeoffboardingMember(member)
    setTargetTransferTeacherId('')
    setDeoffboardError('')
    setDeoffboardStep('review')

    if ((member.studentCount || 0) > 0) {
      setLoadingAssignedStudents(true)
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, name, subject')
          .eq('user_id', member.id)
          .order('name', { ascending: true })
        if (error) throw error
        setAssignedStudents(data || [])
      } catch (err: any) {
        console.error('Failed to load students for instructor:', err)
        setAssignedStudents([])
      } finally {
        setLoadingAssignedStudents(false)
      }
    } else {
      setAssignedStudents([])
    }
  }

  const handleExecuteSafeDeoffboard = async () => {
    if (!deoffboardingMember) return
    setDeoffboardError('')

    const hasStudents = (deoffboardingMember.studentCount || 0) > 0

    // If instructor has active students, must select a target teacher
    if (hasStudents) {
      if (!targetTransferTeacherId) {
        setDeoffboardError(
          locale === 'id' 
            ? 'Harap pilih pengajar pengganti sebelum melakukan transfer murid dan penghapusan akun.' 
            : 'Please select a replacement instructor before transferring students and removing this account.'
        )
        return
      }

      setDeoffboardStep('transferring')
      setTransferProgress({ current: 0, total: assignedStudents.length })
      try {
        let count = 0
        for (const student of assignedStudents) {
          const { error: transferErr } = await supabase.rpc('transfer_student', {
            target_student_id: student.id,
            new_teacher_id: targetTransferTeacherId
          })
          if (transferErr) throw transferErr
          count++
          setTransferProgress({ current: count, total: assignedStudents.length })
        }
      } catch (err: any) {
        setDeoffboardError(
          locale === 'id'
            ? `Gagal memindahkan murid: ${err.message || 'Terjadi kesalahan sistem'}`
            : `Failed to transfer students: ${err.message || 'System error'}`
        )
        setDeoffboardStep('review')
        setTransferProgress(null)
        return
      }
    }

    // Now proceed with instructor deletion
    setDeoffboardStep('deleting')
    try {
      const res = await fetch('/api/admin/instructors/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: deoffboardingMember.id,
          instructorName: deoffboardingMember.name,
          instructorEmail: deoffboardingMember.email
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus instruktur.')

      const targetTeacher = activeMembers.find(m => m.id === targetTransferTeacherId)

      if (hasStudents) {
        fetch('/api/admin/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch_transfer_students',
            entityType: 'student',
            description: `Transfer massal ${assignedStudents.length} murid dari ${deoffboardingMember.name} ke ${targetTeacher?.name || 'guru baru'}`,
            details: {
              studentCount: assignedStudents.length,
              sourceTeacher: deoffboardingMember.name,
              targetTeacher: targetTeacher?.name,
              targetTeacherId: targetTransferTeacherId
            }
          })
        }).catch(console.error)
      }

      triggerToast(
        'success',
        hasStudents
          ? (locale === 'id'
              ? `Berhasil! Seluruh ${assignedStudents.length} murid dialihkan ke ${targetTeacher?.name || 'pengajar baru'} dan akun ${deoffboardingMember.name} telah dinonaktifkan.`
              : `Success! Transferred all ${assignedStudents.length} students to ${targetTeacher?.name || 'new instructor'} and removed ${deoffboardingMember.name}.`)
          : (locale === 'id'
              ? `Akses instruktur ${deoffboardingMember.name} berhasil dihapus.`
              : `Successfully removed instructor ${deoffboardingMember.name}.`)
      )
      setDeoffboardingMember(null)
      await fetchData()
    } catch (err: any) {
      setDeoffboardError(err.message || 'Gagal menghapus instruktur.')
      setDeoffboardStep('review')
    }
  }

  // Copy activation link helper
  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    triggerToast('success', locale === 'id' ? 'Tautan aktivasi disalin ke clipboard!' : 'Activation link copied!')
    setTimeout(() => setCopiedId(null), 3000)
  }

  // Filtered members & invites
  const filteredActiveMembers = useMemo(() => {
    if (!searchQuery.trim()) return activeMembers
    const q = searchQuery.toLowerCase()
    return activeMembers.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.email.toLowerCase().includes(q)
    )
  }, [activeMembers, searchQuery])

  const filteredPendingInvites = useMemo(() => {
    if (!searchQuery.trim()) return pendingInvites
    const q = searchQuery.toLowerCase()
    return pendingInvites.filter(p => 
      p.email.toLowerCase().includes(q) || 
      p.name.toLowerCase().includes(q)
    )
  }, [pendingInvites, searchQuery])

  const fetchAuditLogsList = async () => {
    setLoadingAuditLogs(true)
    try {
      const res = await fetch('/api/admin/audit-logs')
      const data = await res.json()
      if (data?.logs) {
        setAuditLogs(data.logs)
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  const filteredAuditLogs = useMemo(() => {
    if (!searchQuery.trim()) return auditLogs
    const q = searchQuery.toLowerCase()
    return auditLogs.filter(log =>
      log.description?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.user_email?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q)
    )
  }, [auditLogs, searchQuery])

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return iso
    }
  }

  const getActionMeta = (action: string) => {
    switch (action) {
      case 'transfer_student':
        return { label: locale === 'id' ? 'Transfer Murid' : 'Transfer Student' }
      case 'batch_transfer_students':
        return { label: locale === 'id' ? 'Transfer Massal' : 'Batch Transfer' }
      case 'update_ai_settings':
        return { label: locale === 'id' ? 'Pengaturan AI' : 'AI Settings' }
      case 'invite_instructor':
        return { label: locale === 'id' ? 'Undang Guru' : 'Invite Teacher' }
      case 'revoke_invite':
        return { label: locale === 'id' ? 'Batalkan Undangan' : 'Revoke Invite' }
      case 'resend_invite':
        return { label: locale === 'id' ? 'Kirim Ulang' : 'Resend Invite' }
      case 'remove_instructor':
        return { label: locale === 'id' ? 'Hapus Instruktur' : 'Remove Teacher' }
      case 'delete_report':
        return { label: locale === 'id' ? 'Hapus Laporan' : 'Delete Report' }
      default:
        return { label: action }
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'IN'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      
      {/* Primary Content Header (Height: 64px, flex items-center justify-between) */}
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">
            {locale === 'id' ? 'Kelola Instruktur' : 'Manage Instructors'}
          </h2>
          <div className="h-4 w-px bg-black/10" />
          <span className="text-xs font-medium text-neutral-500 font-mono tracking-wider">
            {activeTab === 'active'
              ? `${activeMembers.length} ${locale === 'id' ? 'Instruktur Aktif' : 'Active Members'}`
              : `${pendingInvites.length} ${locale === 'id' ? 'Menunggu Aktivasi' : 'Pending Activation'}`}
          </span>
        </div>

        {/* Action Button: + Undang Instruktur */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setInviteEmail('')
              setInviteName('')
              setInviteRole('teacher')
              setInviteSuccessLink('')
              setInviteError('')
              setShowInviteModal(true)
            }}
            className="bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
          >
            <UserPlus className="w-4 h-4" />
            <span>{locale === 'id' ? 'Undang Instruktur' : 'Invite Instructor'}</span>
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

      {/* Search & Tabs Toolbar */}
      <div className="bg-white border border-black/10 p-4 rounded-2xl shadow-none flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder={locale === 'id' ? 'Cari nama instruktur atau email...' : 'Search instructor name or email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input-premium pl-10 shadow-none"
          />
        </div>

        {/* Tab Switcher */}
        <div className="bg-neutral-100 border border-black/5 p-1 rounded-xl flex gap-1 text-xs font-semibold w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-mono ${
              activeTab === 'active' ? 'bg-black text-white font-bold' : 'text-neutral-500 hover:text-black'
            }`}
          >
            {locale === 'id' ? 'Instruktur Aktif' : 'Active Members'} ({activeMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-mono ${
              activeTab === 'pending' ? 'bg-black text-white font-bold' : 'text-neutral-500 hover:text-black'
            }`}
          >
            {locale === 'id' ? 'Menunggu Aktivasi' : 'Pending Activation'} ({pendingInvites.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('audit')
              fetchAuditLogsList()
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-mono flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-black text-white font-bold' : 'text-neutral-500 hover:text-black'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{locale === 'id' ? 'Jejak Audit' : 'Audit Trail'}</span>
          </button>
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="h-64 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-black animate-spin" />
        </div>
      ) : activeTab === 'active' ? (
        
        /* ACTIVE MEMBERS TAB (TABLE VIEW) */
        <div>
          {filteredActiveMembers.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
              <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                {locale === 'id' ? 'Tidak Ada Instruktur Ditemukan' : 'No Instructors Found'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {locale === 'id' 
                  ? 'Gunakan tombol Undang Instruktur untuk menambahkan pengajar baru.' 
                  : 'Use the Invite Instructor button to onboard new instructors.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-neutral-50 font-mono">
                      <th className="p-4">{locale === 'id' ? 'Pengajar' : 'Instructor'}</th>
                      <th className="p-4">{locale === 'id' ? 'Email' : 'Email'}</th>
                      <th className="p-4">{locale === 'id' ? 'Peran' : 'Role'}</th>
                      <th className="p-4 text-center">{locale === 'id' ? 'Murid Diampu' : 'Students'}</th>
                      <th className="p-4 text-right">{locale === 'id' ? 'Aksi' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-sm text-neutral-700">
                    {filteredActiveMembers.map((member) => {
                      const isCurrent = member.id === currentUserId
                      return (
                        <tr 
                          key={member.id} 
                          className="hover:bg-neutral-50/50 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-xs text-black font-mono shrink-0">
                                {getInitials(member.name)}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-black text-sm">{member.name}</span>
                                {isCurrent && (
                                  <span className="bg-black text-white text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
                                    {locale === 'id' ? 'Anda' : 'You'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-neutral-500 font-mono text-xs">{member.email}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-neutral-100 text-black border border-black/10">
                              {member.role === 'admin' 
                                ? (locale === 'id' ? 'Admin Cabang' : 'Admin') 
                                : (locale === 'id' ? 'Instruktur' : 'Instructor')}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-black font-mono">{member.studentCount || 0}</td>
                          <td className="p-4 text-right">
                            {!isCurrent ? (
                              <button
                                type="button"
                                onClick={() => handleStartDeoffboard(member)}
                                className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                                title={locale === 'id' ? 'Hapus Akses Instruktur' : 'Remove Access'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-neutral-300 font-mono text-xs px-2">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      ) : activeTab === 'pending' ? (

        /* PENDING INVITATIONS TAB (TABLE VIEW) */
        <div>
          {filteredPendingInvites.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
              <Clock className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                {locale === 'id' ? 'Tidak Ada Undangan Menunggu' : 'No Pending Invitations'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {locale === 'id' 
                  ? 'Semua instruktur telah mengaktifkan akun mereka atau belum ada undangan baru.' 
                  : 'All invited teachers have activated their accounts.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-neutral-50 font-mono">
                      <th className="p-4">{locale === 'id' ? 'Email Undangan' : 'Invited Email'}</th>
                      <th className="p-4">{locale === 'id' ? 'Status' : 'Status'}</th>
                      <th className="p-4">{locale === 'id' ? 'Tanggal Diundang' : 'Invited Date'}</th>
                      <th className="p-4 text-right">{locale === 'id' ? 'Aksi' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-sm text-neutral-700">
                    {filteredPendingInvites.map((invite) => {
                      const isActionLoading = actionLoadingEmail === invite.email
                      const isCopied = copiedId === invite.email

                      return (
                        <tr 
                          key={invite.id || invite.email}
                          className="hover:bg-neutral-50/50 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-neutral-500 font-mono shrink-0">
                                <Mail className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-black text-sm block">{invite.email}</span>
                                {invite.name && (
                                  <span className="text-[11px] text-neutral-500 font-mono block">
                                    ({invite.name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-100 text-black border border-black/10">
                              {locale === 'id' ? 'Menunggu Aktivasi' : 'Pending Activation'}
                            </span>
                          </td>
                          <td className="p-4 text-neutral-500 font-mono text-xs">
                            {new Date(invite.invitedAt).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {invite.actionLink && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(invite.actionLink!, invite.email)}
                                  className="text-neutral-500 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-mono"
                                  title={locale === 'id' ? 'Salin Link Aktivasi' : 'Copy Activation Link'}
                                >
                                  {isCopied ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4" />}
                                  <span className="hidden sm:inline">{isCopied ? (locale === 'id' ? 'Tersalin' : 'Salin') : (locale === 'id' ? 'Salin' : 'Copy')}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleResendInvite(invite.email)}
                                className="text-neutral-500 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-mono disabled:opacity-50"
                                title={locale === 'id' ? 'Kirim Ulang Email' : 'Resend Email'}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                                <span className="hidden sm:inline">{locale === 'id' ? 'Kirim Ulang' : 'Resend'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleRevokeInvite(invite.email)}
                                className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                                title={locale === 'id' ? 'Batalkan Undangan' : 'Revoke Invite'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      ) : (

        /* AUDIT TRAIL TAB (TABLE VIEW) */
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-mono text-neutral-400">
              {locale === 'id' 
                ? `Menampilkan ${filteredAuditLogs.length} catatan aktivitas sistem`
                : `Showing ${filteredAuditLogs.length} system activity records`}
            </span>
            <button
              type="button"
              onClick={fetchAuditLogsList}
              disabled={loadingAuditLogs}
              className="text-neutral-500 hover:text-black font-mono text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 bg-white hover:bg-neutral-50 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
              <span>{locale === 'id' ? 'Segarkan' : 'Refresh'}</span>
            </button>
          </div>

          {loadingAuditLogs ? (
            <div className="h-64 flex justify-center items-center bg-white border border-black/10 rounded-2xl">
              <Loader2 className="w-6 h-6 text-black animate-spin" />
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-16 text-center text-neutral-400 shadow-none">
              <History className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-black text-sm font-mono uppercase tracking-wider">
                {locale === 'id' ? 'Belum Ada Jejak Audit' : 'No Audit Records Found'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {locale === 'id' 
                  ? 'Seluruh riwayat aksi krusial (transfer murid, update AI key, perubahan instruktur) akan tercatat otomatis di sini.' 
                  : 'All critical administrative operations will be tracked automatically here.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-neutral-50 font-mono">
                      <th className="p-4">{locale === 'id' ? 'Waktu' : 'Timestamp'}</th>
                      <th className="p-4">{locale === 'id' ? 'Aktivitas' : 'Action'}</th>
                      <th className="p-4">{locale === 'id' ? 'Pelaksana' : 'Actor'}</th>
                      <th className="p-4">{locale === 'id' ? 'Deskripsi' : 'Description'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-sm text-neutral-700">
                    {filteredAuditLogs.map((log) => {
                      const meta = getActionMeta(log.action)
                      return (
                        <tr key={log.id} className="hover:bg-neutral-50/50 transition-colors font-mono">
                          <td className="p-4 text-xs text-neutral-500 whitespace-nowrap">
                            {formatTimestamp(log.created_at)}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold font-mono bg-neutral-100 text-black border border-black/10">
                              {meta.label}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-black block">{log.user_name || 'Admin'}</span>
                            {log.user_email && (
                              <span className="text-[10px] text-neutral-400 block">{log.user_email}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <p className="text-xs text-black leading-relaxed font-sans">{log.description}</p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INVITE INSTRUCTOR MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 shadow-none relative">
            
            {/* Close button */}
            <button 
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <h3 className="text-base font-bold text-black mb-6 uppercase tracking-wider font-mono">
              {locale === 'id' ? 'Undang Instruktur Baru' : 'Invite New Instructor'}
            </h3>

            {/* Error Banner */}
            {inviteError && (
              <div className="bg-white border border-black text-black text-xs px-4 py-3 rounded-xl mb-4 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {/* Success state with direct copy link */}
            {inviteSuccessLink ? (
              <div className="space-y-4">
                <div className="bg-neutral-50 border border-black/10 rounded-xl p-4 flex items-start gap-3">
                  <Check className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-black uppercase font-mono">
                      {locale === 'id' ? 'Undangan Berhasil Dikirim' : 'Invite Sent Successfully'}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      {locale === 'id' 
                        ? `Email undangan aktivasi telah dikirim ke ${inviteEmail}. Anda juga dapat menyalin tautan berikut untuk dibagikan via WhatsApp.`
                        : `Activation email dispatched to ${inviteEmail}. You can also copy the link directly below.`}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Tautan Aktivasi Langsung' : 'Direct Activation Link'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteSuccessLink}
                      className="form-input-premium font-mono text-xs select-all flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(inviteSuccessLink, 'modal-link')}
                      className="bg-black hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedId === 'modal-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'modal-link' ? (locale === 'id' ? 'Tersalin' : 'Copied') : (locale === 'id' ? 'Salin' : 'Copy')}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="bg-white border border-black/10 hover:bg-neutral-100 text-black text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl font-mono cursor-pointer"
                  >
                    {locale === 'id' ? 'Selesai' : 'Done'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                
                {/* Email Input */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Alamat Email Gmail Instruktur' : 'Instructor Gmail Address'} *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="nama.instruktur@gmail.com"
                      className="form-input-premium pl-10 shadow-none font-mono"
                    />
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Nama Panggilan / Catatan (Opsional)' : 'Initial Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder={locale === 'id' ? 'Contoh: Sensei Alex, Kak Budi' : 'e.g. Teacher Alex'}
                    className="form-input-premium shadow-none"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1 font-medium">
                    {locale === 'id' 
                      ? 'Instruktur dapat menentukan nama akun lengkap & kata sandi mereka sendiri saat aktivasi.' 
                      : 'The instructor will set their full name and password upon activation.'}
                  </p>
                </div>

                {/* Role Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Tingkat Hak Akses / Peran' : 'Account Role'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteRole('teacher')}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-350 ${
                        inviteRole === 'teacher'
                          ? 'border-black bg-neutral-100 font-bold text-black'
                          : 'border-black/10 bg-white text-neutral-500 hover:text-black'
                      }`}
                    >
                      <span className="font-bold text-xs block font-mono uppercase">{locale === 'id' ? 'Instruktur' : 'Instructor'}</span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5 font-normal">
                        {locale === 'id' ? 'Kelola murid & buat laporan' : 'Manage assigned students'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInviteRole('admin')}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-350 ${
                        inviteRole === 'admin'
                          ? 'border-black bg-neutral-100 font-bold text-black'
                          : 'border-black/10 bg-white text-neutral-500 hover:text-black'
                      }`}
                    >
                      <span className="font-bold text-xs block font-mono uppercase">{locale === 'id' ? 'Admin Cabang' : 'Branch Admin'}</span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5 font-normal">
                        {locale === 'id' ? 'Akses penuh & kelola tim' : 'Full access & team management'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-black/10">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="bg-white border border-black/10 hover:bg-neutral-100 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl font-mono cursor-pointer"
                  >
                    {locale === 'id' ? 'Batal' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="bg-black hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {inviteSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{locale === 'id' ? 'Mengirim...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>{locale === 'id' ? 'Kirim Undangan' : 'Send Invite'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* SAFE DEOFFBOARDING MODAL */}
      {deoffboardingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 shadow-none relative space-y-4">
            
            {/* Close button */}
            <button 
              type="button"
              disabled={deoffboardStep !== 'review'}
              onClick={() => setDeoffboardingMember(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-black p-1 rounded-lg cursor-pointer disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title & Member Info */}
            <div>
              <h3 className="text-base font-bold text-black uppercase tracking-wider font-mono">
                {locale === 'id' ? 'Hapus Akses Instruktur' : 'Remove Instructor'}
              </h3>
              <p className="text-xs text-neutral-500 font-mono mt-1">
                {deoffboardingMember.name} • {deoffboardingMember.email}
              </p>
            </div>

            {/* Error Banner */}
            {deoffboardError && (
              <div className="bg-white border border-black text-black text-xs px-4 py-3 rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0" />
                <span>{deoffboardError}</span>
              </div>
            )}

            {/* Content: Has students vs 0 students */}
            {(deoffboardingMember.studentCount || 0) > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-neutral-600 font-mono leading-relaxed">
                  {locale === 'id'
                    ? `Instruktur ini memiliki ${deoffboardingMember.studentCount} murid aktif. Silakan pilih pengajar pengganti untuk mengalihkan murid sebelum akun dihapus.`
                    : `This instructor has ${deoffboardingMember.studentCount} active students. Please select a replacement teacher before removing this account.`}
                </p>

                {/* Replacement Teacher Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {locale === 'id' ? 'Pilih Pengajar Pengganti' : 'Select Replacement Teacher'} *
                  </label>
                  <select
                    disabled={deoffboardStep !== 'review'}
                    value={targetTransferTeacherId}
                    onChange={(e) => setTargetTransferTeacherId(e.target.value)}
                    className="form-select-premium font-mono text-xs cursor-pointer w-full"
                  >
                    <option value="">{locale === 'id' ? '-- Pilih Guru Pengganti --' : '-- Select Teacher --'}</option>
                    {activeMembers
                      .filter(m => m.id !== deoffboardingMember.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.studentCount || 0} {locale === 'id' ? 'murid' : 'students'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Compact Students List */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                      {locale === 'id' ? 'Daftar Murid yang Dialihkan' : 'Students to Transfer'} ({loadingAssignedStudents ? '...' : assignedStudents.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => router.push('/students')}
                      className="text-[10px] text-neutral-500 hover:text-black font-mono underline cursor-pointer"
                    >
                      {locale === 'id' ? 'Buka Halaman Murid ↗' : 'Manage in Students ↗'}
                    </button>
                  </div>

                  <div className="max-h-28 overflow-y-auto bg-neutral-50 border border-black/10 rounded-xl p-2.5 divide-y divide-black/5 text-xs font-mono">
                    {loadingAssignedStudents ? (
                      <div className="py-2 text-center text-neutral-400">Memuat murid...</div>
                    ) : assignedStudents.length === 0 ? (
                      <div className="py-2 text-center text-neutral-400">Tidak ada data murid</div>
                    ) : (
                      assignedStudents.map((s) => (
                        <div key={s.id} className="py-1 flex items-center justify-between first:pt-0 last:pb-0">
                          <span className="font-semibold text-black">{s.name}</span>
                          <span className="text-neutral-500 text-[11px]">{s.subject || 'Reguler'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 flex justify-end gap-2.5 border-t border-black/10">
                  <button
                    type="button"
                    disabled={deoffboardStep !== 'review'}
                    onClick={() => setDeoffboardingMember(null)}
                    className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider font-mono disabled:opacity-40"
                  >
                    {locale === 'id' ? 'Batal' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    disabled={!targetTransferTeacherId || deoffboardStep !== 'review'}
                    onClick={handleExecuteSafeDeoffboard}
                    className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider font-mono disabled:opacity-40"
                  >
                    {deoffboardStep === 'transferring' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {transferProgress 
                            ? `${locale === 'id' ? 'Memindahkan' : 'Transferring'} (${transferProgress.current}/${transferProgress.total})...`
                            : (locale === 'id' ? 'Memindahkan...' : 'Transferring...')}
                        </span>
                      </>
                    ) : deoffboardStep === 'deleting' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{locale === 'id' ? 'Menghapus...' : 'Removing...'}</span>
                      </>
                    ) : (
                      <span>{locale === 'id' ? 'Pindahkan & Hapus' : 'Transfer & Remove'}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed font-mono">
                  {locale === 'id'
                    ? `Apakah Anda yakin ingin menghapus akses untuk ${deoffboardingMember.name} (${deoffboardingMember.email})? Pengajar ini tidak akan dapat login lagi.`
                    : `Are you sure you want to remove access for ${deoffboardingMember.name} (${deoffboardingMember.email})? This teacher will lose all access.`}
                </p>

                {/* Modal Footer */}
                <div className="pt-3 flex justify-end gap-2.5 border-t border-black/10">
                  <button
                    type="button"
                    disabled={deoffboardStep !== 'review'}
                    onClick={() => setDeoffboardingMember(null)}
                    className="bg-white border border-black/10 hover:bg-neutral-100 text-black font-semibold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider font-mono disabled:opacity-40"
                  >
                    {locale === 'id' ? 'Batal' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    disabled={deoffboardStep !== 'review'}
                    onClick={handleExecuteSafeDeoffboard}
                    className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-none cursor-pointer text-xs uppercase tracking-wider font-mono disabled:opacity-40"
                  >
                    {deoffboardStep === 'deleting' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{locale === 'id' ? 'Menghapus...' : 'Removing...'}</span>
                      </>
                    ) : (
                      <span>{locale === 'id' ? 'Ya, Hapus' : 'Confirm Remove'}</span>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
