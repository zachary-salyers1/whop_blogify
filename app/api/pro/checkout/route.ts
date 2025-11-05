import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
// import { whopSdk } from '@/lib/whop-sdk'

/**
 * POST /api/pro/checkout
 * Create a checkout configuration for Pro plan subscription
 *
 * TODO: Implement Whop checkout integration when Pro plan is configured
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()

    // TODO: Create checkout configuration for $4.99/month Pro plan
    // You'll need to configure the Pro plan in Whop dashboard first
    // const checkout = await whopSdk.checkout.createCheckoutSession({
    //   plan_id: process.env.PRO_PLAN_ID!,
    //   success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/success`,
    //   cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    //   metadata: {
    //     userId: auth.user.id,
    //     type: 'pro_subscription'
    //   }
    // })

    return NextResponse.json({
      error: 'Pro checkout not yet configured. Please contact support.'
    }, { status: 501 })
  } catch (error) {
    console.error('[API] Error creating Pro checkout:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
