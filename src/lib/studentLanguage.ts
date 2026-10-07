import { SupabaseClient } from '@supabase/supabase-js'

export const FALLBACK_LANG_KEY = 'student_language_map'

/**
 * Fetches the fallback mapping of student IDs to their preferred language ('id' | 'en')
 * stored in app_settings.
 */
export async function fetchStudentLanguageMap(supabase: SupabaseClient): Promise<Record<string, 'id' | 'en'>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', FALLBACK_LANG_KEY)
      .maybeSingle()

    if (error || !data?.value) return {}
    return JSON.parse(data.value) as Record<string, 'id' | 'en'>
  } catch {
    return {}
  }
}

/**
 * Saves a student's preferred language to the fallback app_settings key
 * if the direct `students.language` column has not been migrated yet.
 */
export async function saveStudentLanguageFallback(
  studentId: string,
  language: 'id' | 'en',
  supabase: SupabaseClient
): Promise<void> {
  try {
    const currentMap = await fetchStudentLanguageMap(supabase)
    currentMap[studentId] = language

    await supabase.from('app_settings').upsert({
      key: FALLBACK_LANG_KEY,
      value: JSON.stringify(currentMap),
      updated_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('Failed to save student language fallback:', err)
  }
}

/**
 * Resolves the effective language for a student, prioritizing:
 * 1. student.language (from database column)
 * 2. fallbackMap[student.id] (from app_settings fallback)
 * 3. 'id' default
 */
export function resolveStudentLanguage(
  student?: { id?: string; language?: string } | null,
  fallbackMap?: Record<string, 'id' | 'en'>
): 'id' | 'en' {
  if (!student) return 'id'
  if (student.language === 'en' || student.language === 'id') {
    return student.language
  }
  if (fallbackMap && student.id && (fallbackMap[student.id] === 'en' || fallbackMap[student.id] === 'id')) {
    return fallbackMap[student.id]
  }
  return 'id'
}
