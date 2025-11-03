import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAccess } from '@/lib/auth'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional() // For nested replies (future)
})

/**
 * GET /api/posts/:id/comments
 * Get all comments for a post
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    const { id } = await params

    // Check if post exists and user has access
    const post = await prisma.post.findUnique({
      where: {
        id: BigInt(id),
        isDeleted: false
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check access to post's company
    const userCompany = await prisma.userCompany.findUnique({
      where: {
        unique_user_company: {
          userId: auth.user.id,
          companyId: post.companyId
        },
        hasAccess: true
      }
    })

    if (!userCompany) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch top-level comments (those without a parent)
    const comments = await prisma.comment.findMany({
      where: {
        postId: BigInt(id),
        parentCommentId: null, // Only top-level comments
        isDeleted: false
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
                profilePicUrl: true,
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

    const response = comments.map(comment => ({
      id: comment.id.toString(),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      repliesCount: comment.repliesCount,
      user: {
        id: comment.user.id,
        username: comment.user.username || 'unknown',
        name: comment.user.name || 'Unknown User',
        profilePicUrl: comment.user.profilePicUrl64 || comment.user.profilePicUrl || ''
      },
      replies: comment.replies.map(reply => ({
        id: reply.id.toString(),
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        repliesCount: 0, // Second level replies don't have their own replies
        user: {
          id: reply.user.id,
          username: reply.user.username || 'unknown',
          name: reply.user.name || 'Unknown User',
          profilePicUrl: reply.user.profilePicUrl64 || reply.user.profilePicUrl || ''
        }
      }))
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('[API] Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/posts/:id/comments
 * Create a new comment on a post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAccess()
    const { id } = await params
    const body = await request.json()

    // Validate input
    const validated = createCommentSchema.parse(body)

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: {
        id: BigInt(id),
        isDeleted: false
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check access to post's company
    const userCompany = await prisma.userCompany.findUnique({
      where: {
        unique_user_company: {
          userId: auth.user.id,
          companyId: post.companyId
        },
        hasAccess: true
      }
    })

    if (!userCompany) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create comment (or reply if parentId provided)
    const comment = await prisma.comment.create({
      data: {
        postId: BigInt(id),
        userId: auth.user.id,
        content: validated.content,
        parentCommentId: validated.parentId ? BigInt(validated.parentId) : null
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
        }
      }
    })

    // Update counts
    if (validated.parentId) {
      // Update parent comment reply count
      await prisma.comment.update({
        where: { id: BigInt(validated.parentId) },
        data: {
          repliesCount: {
            increment: 1
          }
        }
      })
    }

    // Update post comment count
    await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        commentsCount: {
          increment: 1
        }
      }
    })

    const response = {
      id: comment.id.toString(),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        username: comment.user.username || 'unknown',
        name: comment.user.name || 'Unknown User',
        profilePicUrl: comment.user.profilePicUrl64 || comment.user.profilePicUrl || ''
      }
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('[API] Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
