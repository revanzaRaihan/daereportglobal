'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import CustomSelect from '@/components/CustomSelect'
import { useTranslation } from '@/components/LocaleProvider'
import { getCachedData, setCachedData } from '@/lib/dataCache'
import { 
  Save, 
  Loader2, 
  Check, 
  X, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Key,
  Smartphone,
  Languages,
  User,
  ShieldCheck,
  FileText,
  Users,
  Settings
} from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale: currentLocale, setLocale: updateGlobalLocale } = useTranslation()

  const cachedSettings = getCachedData<Record<string, string>>('app_settings')
  const cachedStudentCount = getCachedData<number>('settings_student_count')
  const cachedReportCount = getCachedData<number>('settings_report_count')

  // Loaders & Alert states
  const [loading, setLoading] = useState(!cachedSettings)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Personalized Teacher Profile states
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [studentCount, setStudentCount] = useState<number | null>(cachedStudentCount ?? null)
  const [reportCount, setReportCount] = useState<number | null>(cachedReportCount ?? null)

  // Settings form states
  const [provider, setProvider] = useState(() => cachedSettings?.ai_provider || 'gemini')
  const [model, setModel] = useState(() => cachedSettings?.ai_model || 'gemini-2.5-flash')
  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [waNumber, setWaNumber] = useState(() => cachedSettings?.admin_wa_number || '')
  const [locale, setLocale] = useState(() => currentLocale || 'id')

  // UI States
  const [showKey, setShowKey] = useState(false)
  const [keyModified, setKeyModified] = useState(false)

  // Fetch Settings
  const fetchSettings = async () => {
    if (!cachedSettings) {
      setLoading(true)
    }
    try {
      // 1. Fetch authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setUserEmail(user.email || '')
        setIsAdmin(user.app_metadata?.role === 'admin')
      }

      // 2. Fetch system stats
      const [{ count: sCount }, { count: rCount }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true })
      ])
      setStudentCount(sCount ?? 0)
      setReportCount(rCount ?? 0)

      // 3. Fetch app_settings
      const { data } = await supabase.from('app_settings').select('key, value')
      if (data) {
        const settingsMap = new Map(data.map(item => [item.key, item.value]))
        
        const prov = settingsMap.get('ai_provider') || 'gemini'
        const md = settingsMap.get('ai_model') || (prov === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')
        const keyVal = settingsMap.get('ai_api_key') || ''
        const wa = settingsMap.get('admin_wa_number') || ''
        const userLocale = 
          (user?.user_metadata?.app_locale as 'id' | 'en') || 
          (currentLocale as 'id' | 'en') || 
          'id'

        const userTeacherName = 
          user?.user_metadata?.teacher_name || 
          user?.user_metadata?.full_name || 
          user?.user_metadata?.name || 
          (user ? settingsMap.get(`teacher_name_${user.id}`) : '') || 
          (user?.email ? user.email.split('@')[0] : '')

        setProvider(prov)
        setModel(md)
        setWaNumber(wa)
        setLocale(userLocale)
        setTeacherName(userTeacherName)

        // Setup masked key
        if (keyVal) {
          const masked = keyVal.length > 8 
            ? `${keyVal.substring(0, 4)}${'*'.repeat(keyVal.length - 8)}${keyVal.substring(keyVal.length - 4)}` 
            : '*'.repeat(keyVal.length)
          setApiKey(masked)
          setMaskedKey(masked)
        } else {
          setApiKey('')
          setMaskedKey('')
        }
        setKeyModified(false)

        const mapObj: Record<string, string> = {}
        data.forEach(item => { mapObj[item.key] = item.value })
        setCachedData('app_settings', mapObj)
        setCachedData('settings_student_count', sCount ?? 0)
        setCachedData('settings_report_count', rCount ?? 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleKeyChange = (val: string) => {
    setApiKey(val)
    setKeyModified(true)
  }

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(''), 4000)
    } else {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 4000)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const upserts: { key: string; value: string }[] = []

      if (isAdmin) {
        upserts.push(
          { key: 'ai_provider', value: provider },
          { key: 'ai_model', value: model },
          { key: 'admin_wa_number', value: waNumber }
        )

        if (keyModified && !apiKey.includes('*')) {
          upserts.push({ key: 'ai_api_key', value: apiKey.trim() })
        } else if (keyModified && !apiKey.trim()) {
          upserts.push({ key: 'ai_api_key', value: '' })
        }
      }

      if (currentUserId && teacherName.trim()) {
        upserts.push({ key: `teacher_name_${currentUserId}`, value: teacherName.trim() })
      }

      if (upserts.length > 0) {
        const { error } = await supabase.from('app_settings').upsert(upserts)
        if (error) throw error
      }

      // Save user-specific profile & locale preference to user_metadata
      const metadataUpdates: Record<string, any> = {
        app_locale: locale
      }
      if (teacherName.trim()) {
        metadataUpdates.teacher_name = teacherName.trim()
        metadataUpdates.full_name = teacherName.trim()
        metadataUpdates.display_name = teacherName.trim()
      }

      const { error: userMetaError } = await supabase.auth.updateUser({
        data: metadataUpdates
      })
      if (userMetaError) throw userMetaError

      await updateGlobalLocale(locale as 'id' | 'en')

      if (isAdmin) {
        fetch('/api/admin/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_ai_settings',
            entityType: 'settings',
            description: `Memperbarui konfigurasi AI (Provider: ${provider}, Model: ${model}${keyModified ? ', API Key diperbarui' : ''})`,
            details: {
              provider,
              model,
              key_modified: keyModified,
              wa_updated: !!waNumber
            }
          })
        }).catch(console.error)
      }

      triggerToast('success', t('msg_settings_saved'))
      fetchSettings()
      router.refresh()
    } catch (err: any) {
      triggerToast('error', err.message || t('msg_settings_failed'))
    } finally {
      setSaving(false)
    }
  }

  const modelOptions = provider === 'gemini' 
    ? [
        { label: 'Gemini 3.6 Flash', value: 'gemini-3.6-flash' },
        { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
        { label: 'Gemini 3.5 Flash Lite', value: 'gemini-3.5-flash-lite' },
        { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite' },
        { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
        { label: 'Gemini 2.5 Flash (Default)', value: 'gemini-2.5-flash' },
        { label: currentLocale === 'id' ? 'Gemini 2.5 Pro (Lebih Pintar / Lambat)' : 'Gemini 2.5 Pro (Smarter / Slower)', value: 'gemini-2.5-pro' },
        { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
        { label: 'Gemini 1.5 Flash (Legacy)', value: 'gemini-1.5-flash' }
      ]
    : [
        { label: 'Llama 3.1 8B Instant (Default)', value: 'llama-3.1-8b-instant' },
        { label: 'Llama 3 8B (Legacy)', value: 'llama3-8b-8192' },
        { label: currentLocale === 'id' ? 'Llama 3.1 70B (Lebih Pintar)' : 'Llama 3.1 70B (Smarter)', value: 'llama-3.1-70b-versatile' }
      ]

  const handleProviderChange = (prov: string) => {
    setProvider(prov)
    setModel(prov === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')
  }

  return (
    <div className="space-y-6">
      {/* Primary Content Header (Height: 64px, flex items-center justify-between) */}
      <div className="h-16 flex items-center justify-between border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-black tracking-tighter uppercase font-editorial-headline">
            {t('settings_title')}
          </h2>
          <div className="h-4 w-px bg-black/10" />
          <span className="text-xs font-medium text-neutral-500 font-mono tracking-wider">
            {t('settings_subtitle')}
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

      {loading ? (
        <div className="h-64 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-black animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* 2-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* COLUMN 1: Profile & System */}
            <div className="space-y-6">
              
              {/* Teacher Profile Card */}
              <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5 shadow-none hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex items-center justify-between pb-3 border-b border-black/10">
                  <h3 className="text-xs font-bold text-black uppercase tracking-widest flex items-center gap-2 font-mono">
                    <User className="w-4 h-4 text-primary" />
                    {t('settings_sec_profile')}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-100 text-black border border-black/10">
                    {isAdmin ? t('role_branch_admin') : t('role_teacher')}
                  </span>
                </div>

                {/* Account Identity Strip */}
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-50 border border-black/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-base text-black font-mono shrink-0">
                      {teacherName ? teacherName.trim().slice(0, 2).toUpperCase() : (userEmail ? userEmail.slice(0, 2).toUpperCase() : 'DR')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-black truncate">
                          {teacherName || (currentLocale === 'id' ? 'Pengajar' : 'Instructor')}
                        </span>
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                      </div>
                      <p className="text-xs font-mono text-neutral-500 truncate mt-0.5">
                        {userEmail || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="px-2.5 py-1.5 rounded-xl bg-white border border-black/10 flex items-center gap-1.5" title={t('stat_students_count')}>
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-xs font-mono font-bold text-black">{studentCount ?? 0}</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-white border border-black/10 flex items-center gap-1.5" title={t('stat_reports_count')}>
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-xs font-mono font-bold text-black">{reportCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Teacher Display Name Input */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                    <User className="w-3.5 h-3.5 text-neutral-400" />
                    {t('label_teacher_name')}
                  </label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder={t('placeholder_teacher_name')}
                    className="form-input-premium shadow-none"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed font-medium">
                    {currentLocale === 'id' 
                      ? 'Nama pengajar yang tersimpan untuk akun Anda dan dapat dilihat oleh admin cabang.' 
                      : 'Teacher display name stored for your account and visible to the branch admin.'}
                  </p>
                </div>
              </div>

              {/* System & Contacts Section */}
              <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5 shadow-none hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <h3 className="text-xs font-bold text-black uppercase tracking-widest flex items-center gap-2 pb-3 border-b border-black/10 font-mono">
                  <Languages className="w-4 h-4 text-primary" />
                  {t('settings_sec_system')}
                </h3>

                {/* Locale */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                    {t('label_locale')}
                  </label>
                  <CustomSelect
                    options={[
                      { value: 'id', label: currentLocale === 'id' ? 'Bahasa Indonesia' : 'Indonesian' },
                      { value: 'en', label: 'English' }
                    ]}
                    value={locale}
                    onChange={(val) => setLocale(val as 'id' | 'en')}
                    isSearchable={false}
                  />
                </div>

                {/* WA Number */}
                {isAdmin ? (
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                      {t('label_wa')}
                    </label>
                    <input
                      type="text"
                      value={waNumber}
                      onChange={(e) => setWaNumber(e.target.value)}
                      placeholder="Contoh: 628123456789"
                      className="form-input-premium shadow-none font-mono"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1.5 font-medium">
                      {currentLocale === 'id'
                        ? 'Nomor WhatsApp untuk pengiriman salinan laporan progres murid.'
                        : 'WhatsApp number for sending student progress report copies.'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                      {t('label_wa')}
                    </label>
                    <p className="text-xs font-mono text-neutral-700 bg-neutral-50 border border-black/5 rounded-xl px-3.5 py-2.5">
                      {waNumber || (currentLocale === 'id' ? 'Belum dikonfigurasi admin cabang' : 'Not configured by branch admin')}
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* COLUMN 2: AI Credentials */}
            <div>
              {isAdmin ? (
                <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5 shadow-none hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]">
                  <div className="flex items-center justify-between pb-3 border-b border-black/10">
                    <h3 className="text-xs font-bold text-black uppercase tracking-widest flex items-center gap-2 font-mono">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {t('settings_sec_ai')}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-100 text-black border border-black/10">
                      {t('role_branch_admin')}
                    </span>
                  </div>

                  {/* Provider Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                      {t('label_provider')}
                    </label>
                    <CustomSelect
                      options={[
                        { value: 'gemini', label: 'Google Gemini AI' },
                        { value: 'groq', label: 'Groq Cloud API' }
                      ]}
                      value={provider}
                      onChange={handleProviderChange}
                      isSearchable={false}
                    />
                  </div>

                  {/* Model Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">
                      {t('label_model')}
                    </label>
                    <CustomSelect
                      options={modelOptions}
                      value={model}
                      onChange={(val) => setModel(val)}
                      isSearchable={false}
                    />
                  </div>

                  {/* API Key Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                      <Key className="w-3.5 h-3.5 text-neutral-400" />
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        placeholder={provider === 'gemini' ? 'AIzaSy...' : 'gsk_...'}
                        className="form-input-premium pr-12 font-mono shadow-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1 transition-colors cursor-pointer"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed font-medium">
                      {currentLocale === 'id' 
                        ? 'Kredensial API Key ini disimpan aman di database server Supabase Anda dan tidak pernah dipublikasikan keluar.' 
                        : 'This API Key is stored securely in your Supabase database and is never exposed publicly.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5 shadow-none hover:border-black transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]">
                  <div className="flex items-center justify-between pb-3 border-b border-black/10">
                    <h3 className="text-xs font-bold text-black uppercase tracking-widest flex items-center gap-2 font-mono">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {t('settings_sec_ai')}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-100 text-black border border-black/10">
                      {currentLocale === 'id' ? 'Terkoneksi' : 'Connected'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50 border border-black/5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-black/10 flex items-center justify-center font-bold text-black font-mono shrink-0">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-black uppercase font-mono">
                          {currentLocale === 'id' ? 'Mesin AI Dikelola Administrator' : 'AI Engine Managed by Admin'}
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                          {currentLocale === 'id'
                            ? 'Konfigurasi provider, kuota token, dan model AI dikelola terpusat oleh Admin Cabang. Anda dapat langsung membuat laporan belajar tanpa perlu mengatur kredensial teknis.'
                            : 'AI provider, token quota, and models are centrally managed by the Branch Admin. You can generate student reports without configuring technical credentials.'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-500">
                        {currentLocale === 'id' ? 'Status Layanan' : 'Service Status'}
                      </span>
                      <span className="font-bold text-black flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        {currentLocale === 'id' ? 'Aktif & Siap Pakai' : 'Active & Ready'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Action Bar */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto sm:min-w-[200px] bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-xs font-bold uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{currentLocale === 'id' ? 'Menyimpan Pengaturan...' : 'Saving Settings...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{currentLocale === 'id' ? 'Simpan Pengaturan' : 'Save Settings'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}
    </div>
  )
}
