'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Logo from '@/components/Logo'
import { APP_CONFIG } from '@/lib/branding'
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  Sun, 
  Moon, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Mail, 
  Languages, 
  AlertCircle 
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useTranslation } from '@/components/LocaleProvider'
import { clearCachedData } from '@/lib/dataCache'

function ActivateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { isDark, toggleTheme } = useTheme()
  const { locale, setLocale } = useTranslation()

  // Hydration safety mount
  const [mounted, setMounted] = useState(false)

  // Form states - always initialize completely empty
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [token, setToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // UI states
  const [pageLoading, setPageLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [adminLoggedWarning, setAdminLoggedWarning] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const initSession = async () => {
      try {
        const invitedEmailParam = 
          searchParams.get('invited_email') || 
          searchParams.get('email')

        const tokenParam = 
          searchParams.get('token') || 
          searchParams.get('token_hash') || 
          searchParams.get('code')

        if (tokenParam) {
          setToken(tokenParam)
        }

        // 1. Get current browser auth user if any
        const { data: { user } } = await supabase.auth.getUser()

        if (invitedEmailParam) {
          const cleanInvitedEmail = invitedEmailParam.trim().toLowerCase()

          // If the logged-in session belongs to a different user (e.g. Admin testing in same browser):
          if (user && user.email?.toLowerCase() !== cleanInvitedEmail) {
            // Sign out the admin session so it doesn't hijack the invited user's activation
            await supabase.auth.signOut()
          }

          setEmail(cleanInvitedEmail)
          setUsername('')
          setPassword('')
          setConfirmPassword('')
        } else {
          // If no invited_email query param is in URL:
          if (user && user.email) {
            const isAdmin = user.app_metadata?.role === 'admin'

            if (isAdmin) {
              // The browser is currently logged in as an active Admin
              setAdminLoggedWarning(user.email)
            } else {
              setEmail(user.email)
              const metaName = 
                user.user_metadata?.teacher_name || 
                user.user_metadata?.full_name || 
                ''
              setUsername(metaName)
            }
          }
        }
      } catch (err) {
        console.error('Session detection error on activate page:', err)
      } finally {
        setPageLoading(false)
      }
    }

    initSession()
  }, [mounted, searchParams, supabase])

  const calculateStrength = (pass: string) => {
    if (!pass) return 0
    let score = 0
    if (pass.length >= 6) score += 1
    if (pass.length >= 8) score += 1
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1
    if (/[^A-Za-z0-9]/.test(pass)) score += 1
    return score
  }

  const strengthScore = calculateStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!username.trim() || username.trim().length < 2) {
      setErrorMsg(locale === 'id' ? 'Nama/Username pengajar harus minimal 2 karakter.' : 'Instructor name must be at least 2 characters.')
      return
    }

    if (password.length < 6) {
      setErrorMsg(locale === 'id' ? 'Kata sandi minimal harus 6 karakter.' : 'Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg(locale === 'id' ? 'Konfirmasi kata sandi tidak cocok.' : 'Password confirmation does not match.')
      return
    }

    setSubmitting(true)

    try {
      // 1. Send activation payload to server API
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          email,
          token: token || undefined
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengaktifkan akun.')
      }

      // 2. Log in with the newly established credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        setSuccessMsg(
          locale === 'id' 
            ? 'Akun Anda berhasil diaktifkan! Mengalihkan ke halaman login...' 
            : 'Account activated! Redirecting to login...'
        )
        setTimeout(() => {
          router.push('/login')
        }, 1500)
        return
      }

      clearCachedData()
      setSuccessMsg(
        locale === 'id'
          ? `Selamat Datang, ${username.trim()}! Akun Anda telah aktif.`
          : `Welcome, ${username.trim()}! Your account is now active.`
      )

      setTimeout(() => {
        router.refresh()
        router.push('/')
      }, 1200)

    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Terjadi kesalahan saat aktivasi.')
      setSubmitting(false)
    }
  }

  if (!mounted) {
    return (
      <main 
        suppressHydrationWarning
        className="min-h-screen bg-background text-text-primary flex flex-col justify-center items-center p-4"
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span className="text-xs font-mono text-text-secondary">Memuat halaman aktivasi...</span>
        </div>
      </main>
    )
  }

  return (
    <main 
      suppressHydrationWarning
      className="min-h-screen bg-background text-text-primary flex flex-col justify-center items-center p-4 md:p-8 relative selection:bg-accent selection:text-white transition-colors duration-300"
    >
      
      {/* Floating Header Controls */}
      <div className="absolute top-4 right-4 md:top-6 md:right-8 flex items-center gap-2.5 z-30">
        <button
          type="button"
          onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card border border-border-color text-text-secondary hover:text-text-primary hover:border-accent transition-all duration-200 cursor-pointer shadow-xs text-xs font-mono font-semibold"
        >
          <Languages className="w-3.5 h-3.5 text-accent" />
          <span>{locale === 'id' ? 'EN' : 'ID'}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Ganti Tema"
          className="p-2.5 rounded-full bg-card border border-border-color text-text-secondary hover:text-text-primary hover:border-accent transition-all duration-200 cursor-pointer shadow-xs"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Background Accent Glow Ring */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Activation Card */}
      <div className="w-full max-w-[520px] bg-card border border-border-color rounded-3xl p-6 sm:p-8 shadow-xl relative z-10 backdrop-blur-sm">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 p-1.5 flex items-center justify-center">
            <Logo className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-tight leading-tight">{APP_CONFIG.name}</h2>
            <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
              {locale === 'id' ? 'Aktivasi Instruktur Cabang' : 'Instructor Onboarding'}
            </span>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className="bg-accent/10 border border-accent/25 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h1 className="text-sm font-bold text-text-primary">
              {locale === 'id' ? 'Undangan Akses Dikonfirmasi' : 'Invitation Verified'}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
              {locale === 'id' 
                ? 'Lengkapi nama pengajar dan buat kata sandi baru untuk mengaktifkan akun Anda.' 
                : 'Set your instructor name and new password to activate your studio access.'}
            </p>
          </div>
        </div>

        {/* Alert Notifications */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs px-4 py-3 rounded-xl mb-5 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs px-4 py-3.5 rounded-xl mb-5 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* If Admin is testing in the same browser session without explicit invited email */}
        {adminLoggedWarning ? (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 text-center space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-primary">
                {locale === 'id' ? 'Anda Sedang Masuk Sebagai Admin' : 'Currently Signed In as Admin'}
              </h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
                {locale === 'id'
                  ? `Browser Anda saat ini sedang memiliki sesi aktif sebagai Administrator (${adminLoggedWarning}). Akun Anda sudah aktif.`
                  : `You are currently logged in as Administrator (${adminLoggedWarning}). Your account is already active.`}
              </p>
              <p className="text-[11px] text-text-secondary/80 mt-1.5">
                {locale === 'id'
                  ? 'Untuk menguji aktivasi instruktur baru, silakan keluar atau buka tautan di jendela Penyamaran (Incognito).'
                  : 'To test an instructor invite, please sign out or open the link in an Incognito window.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="bg-card hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-border-color text-text-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {locale === 'id' ? 'Ke Dashboard' : 'Go to Dashboard'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut()
                  setAdminLoggedWarning(null)
                  setEmail('')
                  setUsername('')
                }}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {locale === 'id' ? 'Keluar (Sign Out)' : 'Sign Out'}
              </button>
            </div>
          </div>
        ) : pageLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-secondary">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="text-xs font-mono">{locale === 'id' ? 'Memeriksa tautan undangan...' : 'Verifying invitation...'}</span>
          </div>
        ) : (
          <form 
            onSubmit={handleSubmit} 
            autoComplete="off" 
            className="space-y-4"
          >
            
            {/* Email (Readonly Badge) */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {locale === 'id' ? 'Email Terdaftar' : 'Registered Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="email"
                  readOnly
                  autoComplete="off"
                  name="dreport_invited_email"
                  value={email}
                  placeholder="instruktur@gmail.com"
                  className="w-full bg-neutral-100 dark:bg-neutral-800/60 border border-border-color rounded-xl py-2.5 pl-10 pr-10 text-text-primary text-sm font-mono cursor-not-allowed select-all"
                />
                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              </div>
            </div>

            {/* Username / Instructor Name */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {locale === 'id' ? 'Nama / Username Pengajar' : 'Teacher / Instructor Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  name="dreport_instructor_display_name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={locale === 'id' ? 'Contoh: Sensei Raihan, Kak Budi' : 'e.g. Sensei Raihan'}
                  className="w-full bg-background border border-border-color rounded-xl py-2.5 pl-10 pr-4 text-text-primary text-sm placeholder:text-text-secondary/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                />
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                {locale === 'id' 
                  ? 'Nama ini akan dicantumkan pada laporan evaluasi belajar murid.' 
                  : 'This name will appear on student learning evaluation reports.'}
              </p>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {locale === 'id' ? 'Kata Sandi Baru' : 'New Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  name="dreport_new_account_password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border-color rounded-xl py-2.5 pl-10 pr-10 text-text-primary text-sm placeholder:text-text-secondary/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-0.5 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strengthScore >= 1 ? 'bg-red-500' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
                    <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strengthScore >= 2 ? 'bg-amber-500' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
                    <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strengthScore >= 3 ? 'bg-accent' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {strengthScore < 2 ? (locale === 'id' ? 'Lemah (min. 6 karakter)' : 'Weak') : strengthScore === 2 ? (locale === 'id' ? 'Cukup' : 'Medium') : (locale === 'id' ? 'Kuat' : 'Strong')}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {locale === 'id' ? 'Konfirmasi Kata Sandi' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  name="dreport_confirm_new_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border-color rounded-xl py-2.5 pl-10 pr-10 text-text-primary text-sm placeholder:text-text-secondary/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-[0.99] text-sm tracking-wide disabled:opacity-50 mt-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{locale === 'id' ? 'Mengaktifkan Akun...' : 'Activating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{locale === 'id' ? 'Aktifkan Akun & Masuk' : 'Activate Account & Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border-color/60 text-center">
          <span className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">
            &copy; {new Date().getFullYear()} {APP_CONFIG.name} &bull; {APP_CONFIG.tagline}
          </span>
        </div>

      </div>
    </main>
  )
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <span className="text-xs font-mono text-text-secondary">Memuat halaman aktivasi...</span>
      </div>
    }>
      <ActivateContent />
    </Suspense>
  )
}
