import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAccess } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/posts/[id]/like
 * Like a post
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params

    const post = await prisma.post.findUnique({
      where: { uuid: id },
      select: { id: true, companyId: true, isDeleted: true }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Verify access to company
    const hasAccess = await prisma.userCompany.findFirst({
      where: {
        userId: auth.user.id,
        companyId: post.companyId,
        hasAccess: true
      }
    })

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No access to this post' },
        { status: 403 }
      )
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        unique_user_post_like: {
          userId: auth.user.id,
          postId: post.id
        }
      }
    })

    if (existingLike) {
      return NextResponse.json(
        { error: 'Post already liked' },
        { status: 400 }
      )
    }

    // Create like and update count
    await prisma.$transaction([
      prisma.like.create({
        data: {
          userId: auth.user.id,
          postId: post.id
        }
      }),
      prisma.post.update({
        where: { id: post.id },
        data: {
          likesCount: {
            increment: 1
          }
        }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error liking post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/[id]/like
 * Unlike a post
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params

    const post = await prisma.post.findUnique({
      where: { uuid: id },
      select: { id: true, companyId: true, isDeleted: true }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Delete like and update count
    const like = await prisma.like.findUnique({
      where: {
        unique_user_post_like: {
          userId: auth.user.id,
          postId: post.id
        }
      }
    })

    if (!like) {
      return NextResponse.json(
        { error: 'Post not liked' },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.like.delete({
        where: {
          id: like.id
        }
      }),
      prisma.post.update({
        where: { id: post.id },
        data: {
          likesCount: {
            decrement: 1
          }
        }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unliking post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
