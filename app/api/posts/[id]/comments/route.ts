import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAccess } from '@/lib/auth'
import { createCommentSchema } from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/posts/[id]/comments
 * Get all comments for a post (with nested replies)
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Get top-level comments
    const comments = await prisma.comment.findMany({
      where: {
        postId: post.id,
        parentCommentId: null,
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
        replies: {
          where: {
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
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const data = comments.map((comment) => ({
      id: comment.uuid,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      repliesCount: comment.repliesCount,
      user: {
        id: comment.user.id,
        username: comment.user.username ?? 'Unknown',
        name: comment.user.name ?? 'Unknown User',
        profilePicUrl: comment.user.profilePicUrl64 ?? ''
      },
      replies: comment.replies.map((reply) => ({
        id: reply.uuid,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        user: {
          id: reply.user.id,
          username: reply.user.username ?? 'Unknown',
          name: reply.user.name ?? 'Unknown User',
          profilePicUrl: reply.user.profilePicUrl64 ?? ''
        }
      }))
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/posts/[id]/comments
 * Create a comment on a post
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params
    const body = await request.json()

    const validated = createCommentSchema.parse(body)

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

    let parentCommentDbId: bigint | null = null

    // If replying to a comment, verify it exists
    if (validated.parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: {
          uuid: validated.parentCommentId
        },
        select: {
          id: true,
          parentCommentId: true
        }
      })

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }

      // Don't allow replies to replies (max 2 levels)
      if (parentComment.parentCommentId !== null) {
        return NextResponse.json(
          { error: 'Cannot reply to a reply' },
          { status: 400 }
        )
      }

      parentCommentDbId = parentComment.id
    }

    // Create comment and update counts
    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          postId: post.id,
          userId: auth.user.id,
          parentCommentId: parentCommentDbId,
          content: validated.content
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicUrl64: true
            }
          }
        }
      })

      // Update post comment count
      await tx.post.update({
        where: { id: post.id },
        data: {
          commentsCount: {
            increment: 1
          }
        }
      })

      // Update parent comment reply count if this is a reply
      if (parentCommentDbId) {
        await tx.comment.update({
          where: { id: parentCommentDbId },
          data: {
            repliesCount: {
              increment: 1
            }
          }
        })
      }

      return newComment
    })

    return NextResponse.json({
      id: comment.uuid,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        username: comment.user.username ?? 'Unknown',
        name: comment.user.name ?? 'Unknown User',
        profilePicUrl: comment.user.profilePicUrl64 ?? ''
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
