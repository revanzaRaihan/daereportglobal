import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getActiveAiConfig } from '@/lib/ai/config'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized access.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { provider: reqProvider, model: reqModel, apiKey: reqApiKey } = body

    // 2. Resolve active configuration
    const activeConfig = await getActiveAiConfig(supabase)
    
    // Allow testing a newly typed key that hasn't been saved yet
    let targetKey = activeConfig.apiKey
    if (reqApiKey && typeof reqApiKey === 'string' && !reqApiKey.includes('*') && reqApiKey.trim().length > 0) {
      targetKey = reqApiKey.trim()
    }

    const targetProvider = reqProvider || activeConfig.provider || 'gemini'
    const targetModel = reqModel || activeConfig.model || (targetProvider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant')

    if (!targetKey) {
      return NextResponse.json({
        success: false,
        message: 'API Key belum diisi. Masukkan API Key terlebih dahulu atau simpan di Pengaturan.'
      }, { status: 400 })
    }

    const startTime = Date.now()

    if (targetProvider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${targetKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping test. Reply with PONG.' }] }]
        })
      })

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = errJson.error?.message || `HTTP ${res.status}: ${res.statusText}`
        return NextResponse.json({
          success: false,
          latencyMs,
          message: `Koneksi Google Gemini Gagal: ${errMsg}`
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        latencyMs,
        provider: targetProvider,
        model: targetModel,
        message: `Koneksi Berhasil! Model ${targetModel} aktif dan merespons dalam ${latencyMs}ms.`
      })
    } else {
      // Groq
      const url = 'https://api.groq.com/openai/v1/chat/completions'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${targetKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping test. Reply with PONG.' }],
          max_tokens: 10
        })
      })

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = errJson.error?.message || `HTTP ${res.status}: ${res.statusText}`
        return NextResponse.json({
          success: false,
          latencyMs,
          message: `Koneksi Groq Gagal: ${errMsg}`
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        latencyMs,
        provider: targetProvider,
        model: targetModel,
        message: `Koneksi Berhasil! Model ${targetModel} aktif dan merespons dalam ${latencyMs}ms.`
      })
    }
  } catch (error: any) {
    console.error('Test AI API error:', error)
    return NextResponse.json({
      success: false,
      message: `Terjadi kesalahan saat menguji koneksi: ${error.message || 'Unknown error'}`
    }, { status: 500 })
  }
}
