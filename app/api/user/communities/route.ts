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

    // Fetch user's memberships from Whop API
    const response = await fetch(`https://api.whop.com/api/v5/me/memberships`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch memberships from Whop')
    }

    const data = await response.json()

    // Extract unique companies from memberships
    const companiesMap = new Map()

    if (data.data && Array.isArray(data.data)) {
      for (const membership of data.data) {
        if (membership.valid && membership.company) {
          companiesMap.set(membership.company.id, {
            id: membership.company.id,
            name: membership.company.name || membership.company.id
          })

          // Ensure company exists in our database
          await prisma.company.upsert({
            where: { id: membership.company.id },
            create: {
              id: membership.company.id,
              name: membership.company.name || membership.company.id,
              experienceId: membership.company.id,
              isActive: true
            },
            update: {
              name: membership.company.name || membership.company.id
            }
          })

          // Ensure user has access record
          await prisma.userCompany.upsert({
            where: {
              unique_user_company: {
                userId: auth.user.id,
                companyId: membership.company.id
              }
            },
            create: {
              userId: auth.user.id,
              companyId: membership.company.id,
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
