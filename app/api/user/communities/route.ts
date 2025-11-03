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

    // Whop V1 API requires company_id parameter (can't query across all companies)
    // Solution: Use database tracking via webhooks + sync current company

    console.log('[API] Syncing current company membership:', auth.companyId)

    // Ensure current company is synced in database
    try {
      const response = await fetch(`https://api.whop.com/api/v1/memberships?user_ids=${auth.user.id}&company_id=${auth.companyId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[API] Current company membership response:', JSON.stringify(result, null, 2))

        if (result.data && result.data.length > 0) {
          const membership = result.data[0]

          if (membership.company) {
            const companyName = membership.company.title || auth.companyId

            // Update current company in database
            await prisma.company.upsert({
              where: { id: auth.companyId },
              create: {
                id: auth.companyId,
                name: companyName,
                experienceId: auth.companyId,
                isActive: true
              },
              update: {
                name: companyName
              }
            })

            console.log('[API] Synced company:', companyName)
          }
        }
      }
    } catch (apiError) {
      console.error('[API] Failed to sync current company:', apiError)
    }

    console.log('[API] Returning all communities from database')

    // Fallback: return all companies from database
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
  } catch (error) {
    console.error('[API] Error fetching communities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
