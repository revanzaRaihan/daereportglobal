import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // 1. Server-side Rate Limiting (Maksimal 5 masukan per 10 menit per IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown_ip'
    const rateLimit = checkRateLimit(`feedback_ip_${ip}`, { limit: 5, windowMs: 10 * 60 * 1000 })

    if (!rateLimit.success) {
      const retrySeconds = Math.ceil(rateLimit.resetMs / 1000)
      return NextResponse.json(
        {
          error: `Terlalu banyak pengiriman masukan. Harap tunggu ${retrySeconds} detik sebelum mencoba lagi.`
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { student_id, feedback } = body

    if (!student_id || typeof student_id !== 'string') {
      return NextResponse.json({ error: 'ID murid tidak valid.' }, { status: 400 })
    }

    const trimmedFeedback = (feedback || '').trim()
    if (!trimmedFeedback || trimmedFeedback.length < 3) {
      return NextResponse.json({ error: 'Isi masukan terlalu pendek (minimal 3 karakter).' }, { status: 400 })
    }

    if (trimmedFeedback.length > 2000) {
      return NextResponse.json({ error: 'Isi masukan melebihi batas maksimal 2.000 karakter.' }, { status: 400 })
    }

    // 2. Verifikasi data murid di database untuk mendapatkan user_id pengajar yang sah
    const adminClient = createAdminClient()
    const supabase = adminClient || (await createClient())

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, subject, user_id')
      .eq('id', student_id)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Data murid tidak ditemukan.' }, { status: 404 })
    }

    // 3. Simpan ke tabel feedbacks dengan data yang telah diverifikasi
    const { error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        student_id: student.id,
        student_name: student.name,
        subject: student.subject,
        feedback: trimmedFeedback,
        user_id: student.user_id,
        is_read: false
      })

    if (insertError) {
      console.error('Error inserting feedback to database:', insertError)
      return NextResponse.json({ error: 'Gagal menyimpan masukan ke sistem.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Masukan berhasil dikirimkan ke pengajar.'
    })
  } catch (err: any) {
    console.error('API Error in /api/feedback:', err)
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan sistem.' }, { status: 500 })
  }
}
