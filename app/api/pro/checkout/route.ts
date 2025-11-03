import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { WhopAPI } from '@whop/sdk'

const whop = new WhopAPI({
  token: process.env.WHOP_API_KEY!
})

/**
 * POST /api/pro/checkout
 * Create a checkout configuration for Pro plan subscription
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()

    // Create checkout configuration for $4.99/month Pro plan
    const checkout = await whop.checkout.createCheckoutSession({
      plan_id: process.env.PRO_PLAN_ID!, // You'll need to create this plan in Whop dashboard
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      metadata: {
        userId: auth.user.id,
        type: 'pro_subscription'
      }
    })

    return NextResponse.json({
      checkoutUrl: checkout.checkout_url,
      checkoutId: checkout.id
    })
  } catch (error) {
    console.error('[API] Error creating Pro checkout:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
