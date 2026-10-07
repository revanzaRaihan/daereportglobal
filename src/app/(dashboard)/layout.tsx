'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Logo from '@/components/Logo'
import { APP_CONFIG } from '@/lib/branding'
import { useTranslation } from '@/components/LocaleProvider'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { prefetchRouteData, clearCachedData } from '@/lib/dataCache'
import { 
  Users, 
  BookOpen, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  Lightbulb,
  FileText,
  AlertCircle,
  ChevronRight,
  Sun,
  Moon,
  PenTool,
  Inbox,
  Loader2
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()
  const { isDark, toggleTheme } = useTheme()
  const { navigate } = useNavigationProgress()
  
  // Auth & UI States
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // KPI & Metric States
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalReports, setTotalReports] = useState(0)
  const [studentProgressList, setStudentProgressList] = useState<any[]>([])
  const [totalFeedbacks, setTotalFeedbacks] = useState(0)

  const fetchKpis = async (userId: string) => {
    try {
      // 1. Total Students
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
      setTotalStudents(studentCount || 0)

      // 2. Total Reports
      const { count: reportCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
      setTotalReports(reportCount || 0)

      // 3. Total Feedbacks
      const { count: feedbackCount } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
      setTotalFeedbacks(feedbackCount || 0)


      // 4. Student Progress List (top 4 students by meeting count)
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, subject, meeting_count')
        .order('meeting_count', { ascending: false })
        .limit(4)
      setStudentProgressList(studentsData || [])

    } catch (e) {
      console.error('Error loading KPI data:', e)
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        const userIsAdmin = user.app_metadata?.role === 'admin'
        setIsAdmin(userIsAdmin)

        const name = 
          user.user_metadata?.teacher_name || 
          user.user_metadata?.full_name || 
          user.user_metadata?.name || 
          (user.email ? user.email.split('@')[0] : '')
        setTeacherName(name)
        await fetchKpis(user.id)
      }
      setLoading(false)
    }
    getUser()

    // Setup realtime subscription to refresh metrics when data changes
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) fetchKpis(user.id)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      clearCachedData()
      await supabase.auth.signOut()
      router.refresh()
      router.push('/login')
    } catch (err) {
      console.error('Logout error:', err)
      setLoggingOut(false)
    }
  }

  // Keyboard shortcut: close logout modal with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLogoutModal && !loggingOut) {
        setShowLogoutModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLogoutModal, loggingOut])

  const navItems = [
    { name: t('nav_create_report'), href: '/', icon: PenTool },
    { name: t('nav_students'), href: '/students', icon: Users },
    { name: t('nav_dataset'), href: '/dataset', icon: BookOpen },
    { name: t('nav_history'), href: '/history', icon: History },
    { name: t('nav_inbox'), href: '/inbox', icon: Inbox },
    ...(isAdmin ? [{ name: t('nav_instructors') || 'Kelola Instruktur', href: '/instructors', icon: Users }] : []),
    { name: t('nav_settings'), href: '/settings', icon: Settings },
  ]

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="h-screen bg-background text-text-primary flex flex-col overflow-hidden font-sans">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-card border-b border-border-color px-4 py-3 flex items-center justify-between z-30 h-14 shrink-0">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 text-text-primary flex items-center justify-center">
            <Logo className="w-6 h-6" />
          </div>
          <span className="font-bold text-text-primary text-sm tracking-tight">{APP_CONFIG.name}</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* LEFT NAVIGATION SIDEBAR (Width: 288px) */}
        <aside className={`
          absolute inset-y-0 left-0 z-20 w-72 bg-card border-r border-border-color flex flex-col justify-between shrink-0
          transform md:translate-x-0 md:static md:flex transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Top Section: Logo & Tagline */}
            <div 
              onClick={() => navigate('/')}
              className="p-6 border-b border-border-color flex items-center gap-3 shrink-0 cursor-pointer select-none"
            >
              <div className="w-10 h-10 text-text-primary flex items-center justify-center">
                <Logo className="w-8 h-8" />
              </div>
              <div>
                <span className="font-extrabold text-text-primary text-base tracking-tight block leading-tight">{APP_CONFIG.name}</span>
              </div>
            </div>

            {/* Middle Section: Nav Links */}
            <nav className="p-4 space-y-1.5 flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault()
                      setMobileMenuOpen(false)
                      navigate(item.href)
                    }}
                    onMouseEnter={() => {
                      prefetchRouteData(item.href, supabase)
                    }}
                    className={`
                      group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                      ${isActive 
                        ? 'bg-accent text-white font-bold shadow-xs' 
                        : 'text-text-secondary hover:text-accent hover:bg-accent/10 hover:border-accent/25 border border-transparent'}
                    `}
                  >
                    <div className="relative flex items-center justify-center shrink-0">
                      <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-white' : 'text-text-secondary group-hover:text-accent'}`} />
                      {item.href === '/inbox' && totalFeedbacks > 0 && (
                        <span className={`
                          absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-black font-mono leading-none border
                          ${isActive 
                            ? 'bg-white text-accent border-accent' 
                            : 'bg-red-500 text-white border-card'}
                        `}>
                          {totalFeedbacks}
                        </span>
                      )}
                    </div>
                    <span>{item.name}</span>
                  </a>
                )
              })}
            </nav>
          </div>

          {/* Bottom Section: Profile & Logout */}
          <div className="p-4 border-t border-border-color space-y-3 bg-card">
            <div className="flex items-center justify-between p-3 bg-card border border-border-color rounded-xl shadow-none">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold font-mono">
                  {teacherName ? getInitials(teacherName) : (userEmail ? getInitials(userEmail) : 'AI')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{teacherName || t('nav_role')}</p>
                  <p className="text-[10px] text-text-secondary truncate max-w-[110px] font-mono">{userEmail || 'Memuat...'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={toggleTheme}
                  className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer"
                  title="Toggle Theme"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setShowLogoutModal(true)}
                  className="p-1.5 text-text-secondary hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-200 cursor-pointer"
                  title={t('nav_logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PRIMARY CONTENT (Scrollable Area) */}
        <main className="flex-1 overflow-y-auto min-w-0 flex flex-col bg-background">
          <div className="p-6 md:p-8 flex-1 bg-background text-text-primary">
            {children}
          </div>
        </main>

      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => {
            if (!loggingOut) setShowLogoutModal(false)
          }}
        >
          <div 
            className="w-full max-w-sm bg-card border border-border-color rounded-2xl p-6 shadow-2xl relative animate-scale-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close button */}
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon + Titles */}
            <div className="flex flex-col items-center text-center pt-1">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 ring-8 ring-rose-500/5">
                <LogOut className="w-6 h-6 ml-0.5" />
              </div>
              <h3 className="text-base font-bold text-text-primary tracking-tight">
                {t('modal_logout_title')}
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed max-w-[280px]">
                {t('modal_logout_desc')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3 border-t border-border-color">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border-color bg-input-bg hover:bg-black/5 dark:hover:bg-white/5 text-text-primary font-bold text-xs uppercase tracking-wider font-mono transition-colors cursor-pointer disabled:opacity-40"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider font-mono shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('btn_logging_out')}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('btn_confirm_logout')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
