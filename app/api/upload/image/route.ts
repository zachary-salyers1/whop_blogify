import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

// For MVP, we'll store images as base64 data URLs
// In production, you'd want to use S3, R2, or similar cloud storage

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    // Convert to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Get image dimensions using a simple approach
    const dimensions = await getImageDimensions(buffer, file.type)

    return NextResponse.json({
      url: dataUrl,
      mimeType: file.type,
      fileSize: file.size,
      width: dimensions.width,
      height: dimensions.height,
    })
  } catch (error) {
    console.error('[UPLOAD] Error uploading image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

// Simple function to get basic dimensions (for MVP)
async function getImageDimensions(buffer: Buffer, mimeType: string): Promise<{ width: number; height: number }> {
  // For MVP, return default dimensions
  // In production, you'd use sharp or similar library to get actual dimensions
  return { width: 1200, height: 800 }
}
