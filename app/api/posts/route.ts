import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAccess, requireAuth } from '@/lib/auth'
import { createPostSchema, feedQuerySchema } from '@/lib/validations'

/**
 * GET /api/posts
 * Get feed of posts (unified or filtered by company)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const query = feedQuerySchema.parse({
      companyId: searchParams.get('companyId') ?? undefined,
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20'
    })

    const { page, limit, companyId } = query
    const skip = (page - 1) * limit

    // Get list of accessible companies
    let accessibleCompanyIds: string[]

    if (companyId) {
      // Verify access to specific company
      const hasAccess = await prisma.userCompany.findFirst({
        where: {
          userId: auth.user.id,
          companyId,
          hasAccess: true
        }
      })

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No access to this company' },
          { status: 403 }
        )
      }

      accessibleCompanyIds = [companyId]
    } else {
      // Get all accessible companies
      const userCompanies = await prisma.userCompany.findMany({
        where: {
          userId: auth.user.id,
          hasAccess: true
        },
        select: {
          companyId: true
        }
      })

      accessibleCompanyIds = userCompanies.map((uc) => uc.companyId)

      if (accessibleCompanyIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        })
      }
    }

    // Get total count
    const total = await prisma.post.count({
      where: {
        companyId: {
          in: accessibleCompanyIds
        },
        isDeleted: false
      }
    })

    // Get posts
    const posts = await prisma.post.findMany({
      where: {
        companyId: {
          in: accessibleCompanyIds
        },
        isDeleted: false
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
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
          },
          take: 1
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
      orderBy: [
        {
          isPinned: 'desc'
        },
        {
          createdAt: 'desc'
        }
      ],
      skip,
      take: limit
    })

    const data = posts.map((post) => ({
      id: post.uuid,
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
      firstImage: post.media[0]
        ? {
            url: post.media[0].url,
            thumbnailUrl: post.media[0].thumbnailUrl,
            width: post.media[0].width,
            height: post.media[0].height
          }
        : null,
      isLikedByUser: post.likes.length > 0
    }))

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/posts
 * Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAccess()
    const body = await request.json()

    const validated = createPostSchema.parse(body)

    // Check posting permissions
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId }
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    const settings = company.settings as Record<string, any>
    if (settings.posting_permission === 'admins_only' && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can post in this community' },
        { status: 403 }
      )
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        userId: auth.user.id,
        companyId: auth.companyId,
        experienceId: auth.experienceId,
        content: validated.content,
        contentType: validated.contentType,
        media: validated.images
          ? {
              create: validated.images.map((img, index) => ({
                mediaType: 'image',
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                width: img.width,
                height: img.height,
                fileSize: img.fileSize,
                mimeType: img.mimeType,
                displayOrder: index,
                altText: img.altText
              }))
            }
          : undefined
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicUrl64: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        },
        media: true
      }
    })

    return NextResponse.json({
      id: post.uuid,
      content: post.content,
      contentType: post.contentType,
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
        height: m.height,
        altText: m.altText
      }))
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
