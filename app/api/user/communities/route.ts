import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * GET /api/user/communities
 * Get all communities the user has access to by fetching from Whop API
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const headersList = await headers()
    const whopUserToken = headersList.get('x-whop-user-token')

    if (!whopUserToken || !process.env.WHOP_API_KEY) {
      // Fallback to database communities
      const userCompanies = await prisma.userCompany.findMany({
        where: {
          userId: auth.user.id,
          hasAccess: true
        },
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          company: {
            name: 'asc'
          }
        }
      })

      const communities = userCompanies.map((uc) => ({
        id: uc.company.id,
        name: uc.company.name
      }))

      return NextResponse.json({ data: communities })
    }

    // V1 API requires company parameter, so we can only get memberships for current company
    // For multi-community support, we'd need to track this via webhooks
    // For now, just return the current company
    const currentCompany = await prisma.company.findUnique({
      where: { id: auth.companyId },
      select: {
        id: true,
        name: true
      }
    })

    if (!currentCompany) {
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({
      data: [currentCompany]
    })
  } catch (error) {
    console.error('[API] Error fetching communities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
