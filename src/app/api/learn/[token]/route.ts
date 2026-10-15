import { NextRequest, NextResponse } from 'next/server'
import { getPublicModuleByShareToken } from '@/lib/modules/moduleService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ success: false, message: 'Invalid token.' }, { status: 400 })
    }

    const publicModule = await getPublicModuleByShareToken(token)

    if (!publicModule) {
      return NextResponse.json({
        success: false,
        message: 'Modul tidak ditemukan atau akses tautan berbagi telah dinonaktifkan oleh pengajar.'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: publicModule
    })
  } catch (error: any) {
    console.error('Public Learn API Error:', error)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem.' }, { status: 500 })
  }
}
