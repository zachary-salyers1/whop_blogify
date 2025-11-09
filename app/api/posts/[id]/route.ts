import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAccess } from '@/lib/auth'
import { updatePostSchema } from '@/lib/validations'

/**
 * GET /api/posts/:id
 * Get a single post by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    const { id } = await params

    const post = await prisma.post.findUnique({
      where: {
        uuid: id
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
          orderBy: { displayOrder: 'asc' }
        },
        likes: {
          where: { userId: auth.user.id }
        }
      }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user has access to this post's company
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

    // Format response
    const response = {
      id: post.uuid,
      title: post.title,
      content: post.content,
      contentType: post.contentType,
      isPinned: post.isPinned,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      isLikedByUser: post.likes.length > 0,
      user: {
        id: post.user.id,
        username: post.user.username || 'unknown',
        name: post.user.name || 'Unknown User',
        profilePicUrl: post.user.profilePicUrl64 || post.user.profilePicUrl || ''
      },
      company: {
        id: post.company.id,
        name: post.company.name
      },
      media: post.media.map(m => ({
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height,
        mediaType: m.mediaType
      }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Error fetching post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/posts/:id
 * Update a post
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAccess()
    const { id } = await params
    const body = await request.json()

    const validated = updatePostSchema.parse(body)

    const post = await prisma.post.findUnique({
      where: {
        uuid: id
      }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Only the author can edit their own post
    const isAuthor = post.userId === auth.user.id

    if (!isAuthor) {
      return NextResponse.json({ error: 'Only the post author can edit this post' }, { status: 403 })
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { uuid: id },
      data: {
        ...(validated.title !== undefined && { title: validated.title }),
        ...(validated.content !== undefined && { content: validated.content }),
        ...(validated.isPinned !== undefined && { isPinned: validated.isPinned }),
        updatedAt: new Date()
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
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    return NextResponse.json({
      id: updatedPost.uuid,
      title: updatedPost.title,
      content: updatedPost.content,
      contentType: updatedPost.contentType,
      isPinned: updatedPost.isPinned,
      likesCount: updatedPost.likesCount,
      commentsCount: updatedPost.commentsCount,
      createdAt: updatedPost.createdAt.toISOString(),
      user: {
        id: updatedPost.user.id,
        username: updatedPost.user.username ?? 'Unknown',
        name: updatedPost.user.name ?? 'Unknown User',
        profilePicUrl: updatedPost.user.profilePicUrl64 ?? ''
      },
      company: {
        id: updatedPost.company.id,
        name: updatedPost.company.name
      },
      media: updatedPost.media.map((m) => ({
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height,
        mediaType: m.mediaType
      }))
    })
  } catch (error) {
    console.error('[API] Error updating post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/:id
 * Delete a post (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAccess()
    const { id } = await params

    const post = await prisma.post.findUnique({
      where: {
        uuid: id
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Only the author can delete their own post
    const isAuthor = post.userId === auth.user.id

    if (!isAuthor) {
      return NextResponse.json({ error: 'Only the post author can delete this post' }, { status: 403 })
    }

    // Soft delete
    await prisma.post.update({
      where: { uuid: id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
