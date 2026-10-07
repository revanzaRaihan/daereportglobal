import { SupabaseClient } from '@supabase/supabase-js'

// In-memory cache store
const cache: Record<string, { data: any; timestamp: number }> = {}

export function getCachedData<T = any>(key: string): T | null {
  const item = cache[key]
  if (!item) return null
  return item.data as T
}

export function setCachedData(key: string, data: any): void {
  cache[key] = {
    data,
    timestamp: Date.now()
  }
}

export function clearCachedData(key?: string): void {
  if (key) {
    delete cache[key]
  } else {
    Object.keys(cache).forEach(k => delete cache[k])
  }
}

// Helper to prefetch route data before switching page
export async function prefetchRouteData(pathname: string, supabase: SupabaseClient): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isAdmin = user.app_metadata?.role === 'admin'

    if (pathname === '/students') {
      const tasks = [
        (async () => {
          const { data } = await supabase.from('students').select('*').order('name')
          if (data) setCachedData('students', data)
        })()
      ]

      if (isAdmin) {
        tasks.push(
          (async () => {
            const { data } = await supabase.rpc('get_teachers_overview')
            if (data) setCachedData('teachers_overview', data)
          })(),
          (async () => {
            const { data } = await supabase.rpc('get_all_teachers')
            if (data) setCachedData('all_teachers', data)
          })()
        )
      }

      await Promise.all(tasks)
    } 
    else if (pathname === '/history') {
      if (isAdmin) {
        const { data: overview } = await supabase.rpc('get_history_teachers_overview')
        if (overview) setCachedData('history_teachers_overview', overview)
      } else {
        // Calculate monday of this week
        const now = new Date()
        const day = now.getDay()
        const diffToMonday = day === 0 ? 6 : day - 1
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
        const startDate = monday.toISOString().split('T')[0]

        const [studentsRes, reportsRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, name, slug')
            .eq('user_id', user.id)
            .is('deleted_at', null),
          supabase
            .from('reports')
            .select('id, student_id, student_name, subject, meeting_number, report_date, materi, image_url, created_at, updated_at, user_id')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .gte('report_date', startDate)
            .order('report_date', { ascending: false })
            .order('meeting_number', { ascending: false })
        ])

        if (studentsRes.data) setCachedData('history_students', studentsRes.data)
        if (reportsRes.data) setCachedData('history_reports', reportsRes.data)
      }
    } 
    else if (pathname === '/dataset') {
      const [stylesRes, recsRes] = await Promise.all([
        supabase
          .from('dataset_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('recommendation_datasets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ])

      if (stylesRes.data) setCachedData('dataset_styles', stylesRes.data)
      if (recsRes.data) setCachedData('dataset_recs', recsRes.data)
    } 
    else if (pathname === '/inbox') {
      let query = supabase.from('feedbacks').select('*').order('created_at', { ascending: false })
      if (!isAdmin) {
        query = query.eq('user_id', user.id)
      }
      const { data } = await query
      if (data) setCachedData('feedbacks', data)
    } 
    else if (pathname === '/settings') {
      const tasks = [
        (async () => {
          const { data } = await supabase.from('app_settings').select('*')
          if (data) {
            const map: Record<string, string> = {}
            data.forEach((item: any) => { map[item.key] = item.value })
            setCachedData('app_settings', map)
          }
        })(),
        (async () => {
          const { count } = await supabase.from('students').select('*', { count: 'exact', head: true })
          setCachedData('settings_student_count', count || 0)
        })(),
        (async () => {
          const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true })
          setCachedData('settings_report_count', count || 0)
        })()
      ]
      await Promise.all(tasks)
    } 
    else if (pathname === '/') {
      const [studentsRes, countRes, reportsRes] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('dataset_entries').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('student_id, meeting_number, report_date').order('report_date', { ascending: false })
      ])

      if (studentsRes.data) setCachedData('students', studentsRes.data)
      if (countRes.count !== null) setCachedData('dataset_count', countRes.count)
      if (reportsRes.data) setCachedData('latest_reports_summary', reportsRes.data)
    }
  } catch (err) {
    console.warn('Prefetch error for route:', pathname, err)
  }
}
