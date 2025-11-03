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

    // Fetch user's memberships from Whop API (V1)
    // Use the app API key to fetch memberships for this user
    const response = await fetch(`https://api.whop.com/api/v1/memberships?user=${auth.user.id}&valid=true`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] Whop API error:', response.status, errorText)

      // Fallback to database on API error
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
        }
      })

      const communities = userCompanies.map((uc) => ({
        id: uc.company.id,
        name: uc.company.name
      }))

      return NextResponse.json({ data: communities })
    }

    const memberships = await response.json()
    console.log('[API] Whop memberships response:', JSON.stringify(memberships, null, 2))

    // Extract unique companies from memberships
    const companiesMap = new Map()

    // V1 API returns array directly
    if (Array.isArray(memberships)) {
      for (const membership of memberships) {
        if (membership.valid && membership.company) {
          const companyId = membership.company

          companiesMap.set(companyId, {
            id: companyId,
            name: companyId // V1 API doesn't return company name in membership object
          })

          // Ensure company exists in our database
          await prisma.company.upsert({
            where: { id: companyId },
            create: {
              id: companyId,
              name: companyId,
              experienceId: companyId,
              isActive: true
            },
            update: {}
          })

          // Ensure user has access record
          await prisma.userCompany.upsert({
            where: {
              unique_user_company: {
                userId: auth.user.id,
                companyId: companyId
              }
            },
            create: {
              userId: auth.user.id,
              companyId: companyId,
              membershipId: membership.id,
              hasAccess: true,
              role: 'member'
            },
            update: {
              hasAccess: true,
              membershipId: membership.id
            }
          })
        }
      }
    }

    const communities = Array.from(companiesMap.values())

    return NextResponse.json({ data: communities })
  } catch (error) {
    console.error('[API] Error fetching communities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
