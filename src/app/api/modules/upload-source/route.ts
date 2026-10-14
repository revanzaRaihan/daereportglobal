import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { generateUlid } from '@/lib/ulid'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface MagicByteCheck {
  mime: string
  validate: (buf: Buffer) => boolean
}

const WHITELISTED_MIMES: MagicByteCheck[] = [
  {
    mime: 'application/pdf',
    validate: (buf) => buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 // %PDF
  },
  {
    mime: 'image/jpeg',
    validate: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF
  },
  {
    mime: 'image/png',
    validate: (buf) => buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
  },
  {
    mime: 'image/webp',
    validate: (buf) => buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
  }
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'File sumber materi tidak ditemukan.' }, { status: 400 })
    }

    // 2. Size validation (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        message: 'Ukuran file melebihi batas maksimal 10MB.'
      }, { status: 422 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Magic Bytes Validation (Defense against disguised malicious executables)
    const detectedType = WHITELISTED_MIMES.find(m => m.validate(buffer))
    if (!detectedType) {
      return NextResponse.json({
        success: false,
        message: 'Format file tidak didukung atau tidak valid. Hanya menerima dokumen PDF, JPEG, PNG, dan WebP asli.'
      }, { status: 422 })
    }

    const sourceUid = generateUlid()
    const ext = detectedType.mime === 'application/pdf' ? 'pdf' :
                detectedType.mime === 'image/jpeg' ? 'jpg' :
                detectedType.mime === 'image/png' ? 'png' : 'webp'

    const storagePath = `curriculum_sources/1/${sourceUid}.${ext}`

    // 4. Upload to Supabase Storage if bucket exists
    const adminClient = createAdminClient() || supabase
    try {
      await adminClient.storage
        .from('reports')
        .upload(storagePath, buffer, {
          contentType: detectedType.mime,
          upsert: false
        })
    } catch (uploadErr) {
      console.warn('Storage upload error (fallback active):', uploadErr)
    }

    // 5. Intelligent OCR / Text Extraction for Source-to-Module
    let extractedText = ''
    try {
      let apiKey = process.env.AI_API_KEY
      if (!apiKey) {
        const { data: settingsData } = await adminClient.from('app_settings').select('key, value')
        const settings = new Map(settingsData?.map(s => [s.key, s.value]) || [])
        apiKey = settings.get('ai_api_key') || undefined
      }

      // If Gemini API is available, extract syllabus text / concepts directly from image/PDF
      if (apiKey && process.env.AI_PROVIDER !== 'groq') {
        const geminiModel = process.env.AI_MODEL || 'gemini-2.5-flash'
        const base64Data = buffer.toString('base64')
        const ocrUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

        const ocrRes = await fetch(ocrUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: detectedType.mime,
                      data: base64Data
                    }
                  },
                  {
                    text: 'Extract all educational syllabus text, chapter headings, learning targets, exercises, and key curriculum concepts from this page. Provide a clean, organized text summary in Indonesian or English suitable for creating a lesson plan.'
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2000
            }
          })
        })

        if (ocrRes.ok) {
          const ocrData = await ocrRes.json()
          extractedText = ocrData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }
      }
    } catch (extractErr) {
      console.warn('OCR / text extraction notice:', extractErr)
    }

    return NextResponse.json({
      success: true,
      source_uid: sourceUid,
      file_path: storagePath,
      mime_type: detectedType.mime,
      file_size_bytes: file.size,
      extracted_text: extractedText.trim()
    })

  } catch (error: any) {
    console.error('Source Upload Exception:', error)
    return NextResponse.json({
      success: false,
      message: 'Gagal memproses unggahan file materi.'
    }, { status: 500 })
  }
}
