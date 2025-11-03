import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/search?q=query
 * Search blogs by title
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get list of accessible companies
    const userCompanies = await prisma.userCompany.findMany({
      where: {
        userId: auth.user.id,
        hasAccess: true
      },
      select: { companyId: true }
    })

    const accessibleCompanyIds = userCompanies.map((uc) => uc.companyId)

    if (accessibleCompanyIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Search posts by title (case-insensitive)
    const posts = await prisma.post.findMany({
      where: {
        companyId: { in: accessibleCompanyIds },
        isDeleted: false,
        title: {
          contains: query.trim(),
          mode: 'insensitive'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicUrl: true,
            profilePicUrl64: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        },
        media: {
          orderBy: {
            displayOrder: 'asc'
          }
        },
        likes: {
          where: {
            userId: auth.user.id
          },
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit results
    })

    const data = posts.map((post) => ({
      id: post.uuid,
      title: post.title,
      content: post.content,
      contentType: post.contentType,
      isPinned: post.isPinned,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      user: {
        id: post.user.id,
        username: post.user.username ?? 'Unknown',
        name: post.user.name ?? 'Unknown User',
        profilePicUrl: post.user.profilePicUrl64 ?? ''
      },
      company: {
        id: post.company.id,
        name: post.company.name
      },
      media: post.media.map((m) => ({
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height
      })),
      isLikedByUser: post.likes.length > 0
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[API] Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
