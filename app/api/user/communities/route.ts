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

    // Fetch all memberships for this user across ALL companies
    console.log('[API] Fetching memberships for user:', auth.user.id)
    try {
      const apiUrl = `https://api.whop.com/api/v1/memberships?user_ids=${auth.user.id}`
      console.log('[API] Request URL:', apiUrl)

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('[API] Response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('[API] Whop memberships response:', JSON.stringify(result, null, 2))
        console.log('[API] Number of memberships found:', result.data?.length || 0)

        // Extract and store companies
        const companiesMap = new Map()

        if (result.data && Array.isArray(result.data)) {
          for (const membership of result.data) {
            // Check if membership is valid/active
            if (membership.status === 'active' && membership.company) {
              const companyId = membership.company.id
              const companyName = membership.company.title || companyId

              companiesMap.set(companyId, {
                id: companyId,
                name: companyName
              })

              // Store in database for caching
              await prisma.company.upsert({
                where: { id: companyId },
                create: {
                  id: companyId,
                  name: companyName,
                  experienceId: companyId,
                  isActive: true
                },
                update: {
                  name: companyName
                }
              })

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

        if (companiesMap.size > 0) {
          return NextResponse.json({
            data: Array.from(companiesMap.values())
          })
        }
      } else {
        const errorText = await response.text()
        console.error('[API] Whop API error response:', response.status, errorText)
      }
    } catch (apiError) {
      console.error('[API] Whop API call failed, falling back to database:', apiError)
    }

    console.log('[API] Falling back to database for communities')

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
