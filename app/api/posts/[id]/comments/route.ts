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

    // Fetch comments
    const comments = await prisma.comment.findMany({
      where: {
        postId: BigInt(id),
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
    })

    const response = comments.map(comment => ({
      id: comment.id.toString(),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        username: comment.user.username || 'unknown',
        name: comment.user.name || 'Unknown User',
        profilePicUrl: comment.user.profilePicUrl64 || comment.user.profilePicUrl || ''
      }
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

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        postId: BigInt(id),
        userId: auth.user.id,
        content: validated.content
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
        { error: 'Invalid input', details: error.errors },
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
