import { createAdminClient } from '@/utils/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

export interface ActiveAiConfig {
  provider: string
  apiKey: string
  model: string
}

function isValidApiKey(val?: string | null): boolean {
  if (!val) return false
  const trimmed = val.trim()
  if (!trimmed) return false
  if (
    trimmed === 'your-ai-api-key-here' ||
    trimmed === 'your-api-key-here' ||
    trimmed === 'your-api-key' ||
    trimmed.startsWith('your-') ||
    trimmed.startsWith('YOUR_')
  ) {
    return false
  }
  return true
}

/**
 * Resolves active AI configuration prioritizing user settings saved via the web dashboard (Option / Pengaturan).
 * Falls back gracefully to server environment variables if valid.
 */
export async function getActiveAiConfig(supabase?: SupabaseClient): Promise<ActiveAiConfig> {
  const adminClient = createAdminClient()
  const dbClient = adminClient || supabase

  let dbSettings = new Map<string, string>()

  if (dbClient) {
    try {
      const { data } = await dbClient.from('app_settings').select('key, value')
      if (data) {
        dbSettings = new Map(data.map(s => [s.key, s.value]))
      }
    } catch (e) {
      console.warn('Failed to fetch AI configuration from app_settings:', e)
    }
  }

  // 1. Resolve API Key: First priority is user settings saved in Option/Settings UI
  let apiKey = dbSettings.get('ai_api_key')
  if (!isValidApiKey(apiKey)) {
    // Second priority is environment variable if it's not a template placeholder
    if (isValidApiKey(process.env.AI_API_KEY)) {
      apiKey = process.env.AI_API_KEY
    } else {
      apiKey = ''
    }
  }

  // 2. Resolve Provider: First priority is user settings in Option/Settings UI
  const provider = dbSettings.get('ai_provider') || process.env.AI_PROVIDER || 'gemini'

  // 3. Resolve Model: First priority is user settings in Option/Settings UI
  const defaultModel = provider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant'
  const model = dbSettings.get('ai_model') || process.env.AI_MODEL || defaultModel

  return {
    provider,
    apiKey: (apiKey || '').trim(),
    model
  }
}
