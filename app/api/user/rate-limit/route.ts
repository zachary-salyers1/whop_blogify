import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getRateLimitInfo } from '@/lib/rate-limit'

/**
 * GET /api/user/rate-limit
 * Get current user's rate limit status
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    const rateLimit = await getRateLimitInfo(auth.user.id)

    return NextResponse.json({
      count: rateLimit.count,
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt.toISOString()
    })
  } catch (error) {
    console.error('[API] Error fetching rate limit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
