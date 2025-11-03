import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/posts/:id/pin
 * Pin or unpin a post (admin only)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    const { id } = await context.params

    // Find the post
    const post = await prisma.post.findFirst({
      where: {
        uuid: id,
        isDeleted: false
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check if user is admin of the community
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: auth.user.id,
        companyId: post.companyId,
        hasAccess: true
      }
    })

    if (!userCompany || userCompany.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can pin posts' },
        { status: 403 }
      )
    }

    // Check if we're already at max pinned posts (3)
    if (!post.isPinned) {
      const pinnedCount = await prisma.post.count({
        where: {
          companyId: post.companyId,
          isPinned: true,
          isDeleted: false
        }
      })

      if (pinnedCount >= 3) {
        return NextResponse.json(
          { error: 'Maximum 3 pinned posts per community' },
          { status: 400 }
        )
      }
    }

    // Toggle pin status
    const updatedPost = await prisma.post.update({
      where: {
        id: post.id
      },
      data: {
        isPinned: !post.isPinned
      }
    })

    return NextResponse.json({
      success: true,
      isPinned: updatedPost.isPinned
    })
  } catch (error) {
    console.error('[API] Error pinning post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
