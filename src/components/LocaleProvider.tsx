'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { translations } from '@/lib/translations'

type Locale = 'id' | 'en'

interface LocaleContextProps {
  locale: Locale;
  setLocale: (loc: Locale) => Promise<void>;
  t: (key: keyof typeof translations['id']) => string;
}

const LocaleContext = createContext<LocaleContextProps | undefined>(undefined)

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id')
  const supabase = createClient()

  // 1. Sync from localStorage (fast sync) on mount
  useEffect(() => {
    const cached = localStorage.getItem('app_locale') as Locale
    if (cached === 'id' || cached === 'en') {
      setLocaleState(cached)
    }

    // 2. Sync from Supabase user_metadata (source of truth per user)
    const fetchUserLocale = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const userLocale = user?.user_metadata?.app_locale as Locale
        if (userLocale === 'id' || userLocale === 'en') {
          setLocaleState(userLocale)
          try {
            localStorage.setItem('app_locale', userLocale)
          } catch {
            // Ignore storage write error
          }
        }
      } catch (e) {
        console.error('Failed to load user locale setting', e)
      }
    }
    fetchUserLocale()

    // 3. Listen to auth state changes to re-sync when user signs in or profile updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userLocale = session?.user?.user_metadata?.app_locale as Locale
      if (userLocale === 'id' || userLocale === 'en') {
        setLocaleState(userLocale)
        try {
          localStorage.setItem('app_locale', userLocale)
        } catch {
          // Ignore storage write error
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem('app_locale', newLocale)
    } catch {
      // Ignore storage write error
    }
    
    // Save to user_metadata if user is logged in
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.auth.updateUser({
          data: { app_locale: newLocale }
        })
      }
    } catch (e) {
      console.error('Failed to save locale to user metadata', e)
    }
  }

  const t = (key: keyof typeof translations['id']) => {
    return translations[locale]?.[key] || translations['id']?.[key] || String(key)
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LocaleProvider')
  }
  return context
}
