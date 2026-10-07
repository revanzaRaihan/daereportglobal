'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useTranslation } from '@/components/LocaleProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { getCachedData, setCachedData } from '@/lib/dataCache'
import { 
  Inbox, 
  Trash2, 
  Loader2, 
  User, 
  BookOpen, 
  Clock, 
  MessageSquare,
  X,
  Check
} from 'lucide-react'
import { getRelativeTime } from '@/lib/dateUtils'

export default function InboxPage() {
  const supabase = createClient()
  const { t, locale } = useTranslation()
  const { confirm } = useConfirm()
  const cachedFeedbacks = getCachedData<any[]>('feedbacks')
  const [feedbacks, setFeedbacks] = useState<any[]>(cachedFeedbacks || [])
  const [loading, setLoading] = useState(!cachedFeedbacks)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const fetchFeedbacks = async () => {
    if (!feedbacks.length) {
      setLoading(true)
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const isAdmin = user.app_metadata?.role === 'admin'

        let query = supabase
          .from('feedbacks')
          .select('*')
          .order('created_at', { ascending: false })

        if (!isAdmin) {
          query = query.eq('user_id', user.id)
        }

        const { data, error } = await query

        if (error) throw error
        if (data) {
          setFeedbacks(data)
          setCachedData('feedbacks', data)
        }

        const unread = data?.filter((f: any) => !f.is_read) || []
        if (unread.length > 0) {
          const unreadIds = unread.map((f: any) => f.id)
          await supabase
            .from('feedbacks')
            .update({ is_read: true })
            .in('id', unreadIds)
        }
      }
    } catch (e: any) {
      console.error(e)
      triggerToast('error', e.message || 'Gagal memuat masukan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedbacks()
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

  const handleDeleteFeedback = (id: string) => {
    confirm({
      message: locale === 'id' 
        ? 'Apakah Anda yakin ingin menghapus masukan ini?' 
        : 'Are you sure you want to delete this feedback?',
      onConfirm: async () => {
        const { error } = await supabase.from('feedbacks').delete().eq('id', id)
        if (error) throw error

        triggerToast('success', t('msg_feedback_deleted'))
        fetchFeedbacks()
      }
    })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">
              {t('inbox_title')}
            </h2>
          </div>
        </div>
        <span className="text-xs font-medium text-neutral-500 font-mono tracking-wider">
          {feedbacks.length} Messages
        </span>
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
        <>
          {feedbacks.length === 0 ? (
            <div className="border border-dashed border-black/10 bg-white rounded-2xl p-12 text-center text-neutral-400 shadow-none">
              <Inbox className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-bold text-sm text-black font-mono uppercase tracking-wider">
                {t('inbox_empty_title')}
              </p>
              <p className="text-xs text-neutral-550 mt-1">
                {t('inbox_empty_desc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {feedbacks.map((f) => (
                <div 
                  key={f.id} 
                  className="bg-white border border-black/10 rounded-2xl p-5 shadow-none hover:border-black/35 transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-black/5 text-black flex items-center justify-center font-bold text-xs font-mono uppercase">
                          {getInitials(f.student_name)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-black leading-tight">
                            {f.student_name}
                          </h4>
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-neutral-500 font-semibold font-mono uppercase">
                            <BookOpen className="w-3 h-3 text-neutral-455" />
                            {f.subject}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFeedback(f.id)}
                        className="text-neutral-400 hover:text-black p-1.5 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                        title={locale === 'id' ? 'Hapus Masukan' : 'Delete Feedback'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-neutral-50 border border-black/5 rounded-xl p-4 text-xs text-neutral-850 leading-relaxed font-sans min-h-[80px] whitespace-pre-wrap">
                      {f.feedback}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/5 flex items-center gap-1.5 text-[10px] text-neutral-450 font-mono font-semibold uppercase">
                    <Clock className="w-3.5 h-3.5" />
                    {getRelativeTime(f.created_at, locale)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
