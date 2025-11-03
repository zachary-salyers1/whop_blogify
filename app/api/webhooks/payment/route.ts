import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/webhooks/payment
 * Handle Whop payment webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json()

    console.log('[WEBHOOK] Payment event received:', event.type)

    // Verify webhook signature (in production, verify using Whop's webhook secret)
    // const signature = request.headers.get('x-whop-signature')

    switch (event.type) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(event)
        break

      case 'membership.went_valid':
        await handleMembershipValid(event)
        break

      case 'membership.went_invalid':
        await handleMembershipInvalid(event)
        break

      default:
        console.log('[WEBHOOK] Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[WEBHOOK] Error processing payment webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSucceeded(event: any) {
  const { user_id, membership_id, metadata } = event.data

  if (metadata?.type === 'pro_subscription') {
    console.log('[WEBHOOK] Creating Pro subscription for user:', user_id)

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await prisma.proSubscription.create({
      data: {
        userId: metadata.userId,
        whopMembershipId: membership_id,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false
      }
    })

    console.log('[WEBHOOK] Pro subscription created successfully')
  }
}

async function handleMembershipValid(event: any) {
  const { user_id, membership_id } = event.data

  const subscription = await prisma.proSubscription.findFirst({
    where: { whopMembershipId: membership_id }
  })

  if (subscription) {
    await prisma.proSubscription.update({
      where: { id: subscription.id },
      data: { status: 'active' }
    })
    console.log('[WEBHOOK] Pro subscription activated')
  }
}

async function handleMembershipInvalid(event: any) {
  const { membership_id } = event.data

  const subscription = await prisma.proSubscription.findFirst({
    where: { whopMembershipId: membership_id }
  })

  if (subscription) {
    await prisma.proSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'expired',
        canceledAt: new Date()
      }
    })
    console.log('[WEBHOOK] Pro subscription expired')
  }
}
