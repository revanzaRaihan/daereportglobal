'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import Logo from '@/components/Logo'
import { APP_CONFIG } from '@/lib/branding'
import { Mail, Lock, Eye, EyeOff, Loader2, Sun, Moon, ArrowRight, Languages } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useTranslation } from '@/components/LocaleProvider'
import { clearCachedData } from '@/lib/dataCache'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isDark, toggleTheme } = useTheme()
  const { t, locale, setLocale } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err === 'auth_callback_failed') {
        setErrorMsg(t('login_err_google_auth'))
      }
    }
  }, [t])

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setErrorMsg('')
    clearCachedData()
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) {
        setErrorMsg(error.message)
        setGoogleLoading(false)
      }
    } catch {
      setErrorMsg(t('login_err_google_connect'))
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          setErrorMsg(error.message)
        } else if (data.user) {
          setSuccessMsg(`${t('login_success_signup_prefix')} ${data.user.email}! ${t('login_success_signup_suffix')}`)
          setEmail('')
          setPassword('')
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setErrorMsg(
            error.message === 'Invalid login credentials'
              ? t('login_err_invalid_creds')
              : error.message
          )
        } else {
          clearCachedData()
          router.refresh()
          router.push('/')
        }
      }
    } catch {
      setErrorMsg(t('login_err_connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-text-primary flex flex-col justify-center items-center p-4 md:p-8 relative selection:bg-accent selection:text-white transition-colors duration-300">
      
      {/* Floating Header Controls */}
      <div className="absolute top-4 right-4 md:top-6 md:right-8 flex items-center gap-2.5 z-30">
        <button
          type="button"
          onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          aria-label={t('login_lang_toggle')}
          title={t('login_lang_toggle')}
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
          title={isDark ? t('login_theme_light') : t('login_theme_dark')}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Split Modal / Card Container */}
      <div className="w-full max-w-[960px] bg-card border border-border-color rounded-3xl p-3 md:p-4 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10 overflow-hidden">
        
        {/* Left Column: Visual Showcase Banner (Inspired by mockup) */}
        <div className="hidden md:flex md:col-span-5 relative rounded-2xl overflow-hidden min-h-[560px] flex-col justify-between p-7 select-none">
          {/* Background image & atmospheric overlay */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{ backgroundImage: `url('/login-bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/50" />
          
          {/* Subtle Accent Glow Ring */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-accent/25 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Bar */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center">
                <Logo className="w-7 h-7" />
              </div>
              <div>
                <span className="font-extrabold text-white text-base tracking-tight block leading-tight">
                  {APP_CONFIG.name}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Editorial Caption */}
          <div className="relative z-10 text-white space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug">
                {t('login_banner_headline')} <br />
                <span className="text-white/90">{t('login_banner_subheadline')}</span>
              </h2>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">
                {t('login_banner_desc')}
              </p>
            </div>

            {/* Slider / Progress indicator dots */}
            <div className="flex items-center gap-2 pt-2">
              <div className="w-7 h-1 rounded-full bg-accent" />
              <div className="w-2 h-1 rounded-full bg-white/35" />
              <div className="w-2 h-1 rounded-full bg-white/35" />
            </div>
          </div>
        </div>

        {/* Right Column: Clean Form */}
        <div className="md:col-span-7 p-4 sm:p-6 md:p-8 flex flex-col justify-center">
          
          {/* Mobile Top Brand (visible on small screens only) */}
          <div className="md:hidden flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-card border border-border-color p-1 flex items-center justify-center">
              <Logo className="w-7 h-7" />
            </div>
            <div>
              <span className="font-extrabold text-text-primary text-base tracking-tight block">
                {APP_CONFIG.name}
              </span>
            </div>
          </div>

          {/* Title and Switcher */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {isSignUp ? t('login_title_signup') : t('login_title_signin')}
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1.5 flex items-center gap-1.5">
              <span>{isSignUp ? t('login_prompt_has_account') : t('login_prompt_no_account')}</span>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className="text-accent hover:underline font-semibold cursor-pointer"
              >
                {isSignUp ? t('login_action_signin') : t('login_action_signup')}
              </button>
            </p>
          </div>

          {/* Alert Error Message */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs px-4 py-3 rounded-xl mb-5 font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Alert Success Message */}
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs px-4 py-3.5 rounded-xl mb-5 font-mono leading-relaxed">
              {successMsg}
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full bg-background hover:bg-card border border-border-color hover:border-accent text-text-primary font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.99] text-xs sm:text-sm disabled:opacity-50 mb-5 shadow-xs"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span className="font-mono text-xs uppercase tracking-wider">{t('login_connecting')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.35 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span className="font-semibold">{t('login_google_btn')}</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center mb-5">
            <div className="border-t border-border-color w-full"></div>
            <span className="bg-card px-3 text-[11px] uppercase font-mono text-text-secondary tracking-wider shrink-0">
              {t('login_divider')}
            </span>
            <div className="border-t border-border-color w-full"></div>
          </div>

          {/* Standard Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {t('login_label_email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full bg-background border border-border-color rounded-xl py-2.5 pl-10 pr-4 text-text-primary text-sm placeholder:text-text-secondary/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 font-mono">
                {t('login_label_password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
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
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border-color text-accent focus:ring-accent accent-[#4da23c] cursor-pointer"
                />
                <span>{t('login_remember_me')}</span>
              </label>
            </div>

            {/* CTA Submit Button (Accent Color #4da23c) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-[0.99] text-sm tracking-wide disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{t('login_processing')}</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? t('login_btn_signup') : t('login_btn_signin')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-border-color/60 text-center">
            <span className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">
              &copy; {new Date().getFullYear()} {APP_CONFIG.name}
            </span>
          </div>
        </div>

      </div>
    </main>
  )
}
