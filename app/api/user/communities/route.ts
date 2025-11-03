import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/user/communities
 * Get all communities the user has access to
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()

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
