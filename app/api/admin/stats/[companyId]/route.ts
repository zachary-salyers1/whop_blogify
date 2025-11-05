import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/admin/stats/:companyId
 * Get analytics for community
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { companyId } = await params

    // Verify admin access to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: auth.user.id,
        companyId: companyId,
        hasAccess: true,
        role: {
          in: ['admin', 'owner']
        }
      }
    })

    if (!userCompany) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get time ranges
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Run all queries in parallel for performance
    const [
      totalPosts,
      totalLikes,
      totalComments,
      activeUsers7d,
      activeUsers30d,
      posts7d,
      posts30d,
      topPosters,
      recentPosts
    ] = await Promise.all([
      // Total posts
      prisma.post.count({
        where: {
          companyId: companyId,
          isDeleted: false
        }
      }),

      // Total likes
      prisma.like.count({
        where: {
          post: {
            companyId: companyId,
            isDeleted: false
          }
        }
      }),

      // Total comments
      prisma.comment.count({
        where: {
          post: {
            companyId: companyId,
            isDeleted: false
          },
          isDeleted: false
        }
      }),

      // Active users (7 days) - users who posted, liked, or commented
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT user_id FROM posts WHERE company_id = ${companyId} AND created_at >= ${sevenDaysAgo} AND is_deleted = false
          UNION
          SELECT l.user_id FROM likes l
          INNER JOIN posts p ON l.post_id = p.id
          WHERE p.company_id = ${companyId} AND l.created_at >= ${sevenDaysAgo} AND p.is_deleted = false
          UNION
          SELECT c.user_id FROM comments c
          INNER JOIN posts p ON c.post_id = p.id
          WHERE p.company_id = ${companyId} AND c.created_at >= ${sevenDaysAgo} AND c.is_deleted = false AND p.is_deleted = false
        ) as active_users
      `,

      // Active users (30 days)
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT user_id FROM posts WHERE company_id = ${companyId} AND created_at >= ${thirtyDaysAgo} AND is_deleted = false
          UNION
          SELECT l.user_id FROM likes l
          INNER JOIN posts p ON l.post_id = p.id
          WHERE p.company_id = ${companyId} AND l.created_at >= ${thirtyDaysAgo} AND p.is_deleted = false
          UNION
          SELECT c.user_id FROM comments c
          INNER JOIN posts p ON c.post_id = p.id
          WHERE p.company_id = ${companyId} AND c.created_at >= ${thirtyDaysAgo} AND c.is_deleted = false AND p.is_deleted = false
        ) as active_users
      `,

      // Posts in last 7 days
      prisma.post.count({
        where: {
          companyId: companyId,
          isDeleted: false,
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      }),

      // Posts in last 30 days
      prisma.post.count({
        where: {
          companyId: companyId,
          isDeleted: false,
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      }),

      // Top 5 posters
      prisma.post.groupBy({
        by: ['userId'],
        where: {
          companyId: companyId,
          isDeleted: false
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 5
      }),

      // Recent posts for activity feed
      prisma.post.findMany({
        where: {
          companyId: companyId,
          isDeleted: false
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })
    ])

    // Get user details for top posters
    const topPosterUserIds = topPosters.map(tp => tp.userId)
    const topPosterUsers = await prisma.user.findMany({
      where: {
        id: {
          in: topPosterUserIds
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        profilePicUrl64: true
      }
    })

    // Map top posters with user details
    const topPostersWithDetails = topPosters.map(tp => {
      const user = topPosterUsers.find(u => u.id === tp.userId)
      return {
        userId: tp.userId,
        username: user?.username || 'Unknown',
        name: user?.name || 'Unknown User',
        profilePicUrl: user?.profilePicUrl64 || null,
        postCount: tp._count.id
      }
    })

    return NextResponse.json({
      data: {
        overview: {
          totalPosts,
          totalLikes,
          totalComments,
          activeUsers7d: Number(activeUsers7d[0]?.count || 0),
          activeUsers30d: Number(activeUsers30d[0]?.count || 0)
        },
        activity: {
          posts7d,
          posts30d,
          avgPostsPerDay7d: Number((posts7d / 7).toFixed(1)),
          avgPostsPerDay30d: Number((posts30d / 30).toFixed(1))
        },
        topPosters: topPostersWithDetails,
        recentPosts: recentPosts.map(post => ({
          id: post.uuid,
          title: post.title,
          content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          createdAt: post.createdAt.toISOString(),
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          user: {
            id: post.user.id,
            username: post.user.username || 'Unknown',
            name: post.user.name || 'Unknown User'
          }
        }))
      }
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
