import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/pro/status
 * Check if user has an active Pro subscription
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()

    const subscription = await prisma.proSubscription.findFirst({
      where: {
        userId: auth.user.id,
        status: 'active',
        currentPeriodEnd: {
          gte: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const isPro = !!subscription

    return NextResponse.json({
      isPro,
      subscription: subscription ? {
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      } : null
    })
  } catch (error) {
    console.error('[API] Error checking Pro status:', error)
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    )
  }
}
