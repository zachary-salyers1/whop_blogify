import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAccess } from '@/lib/auth'
import { updatePostSchema } from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/posts/[id]
 * Get a single post by UUID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    const { id } = await context.params

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
        links: true,
        likes: {
          where: {
            userId: auth.user.id
          },
          select: {
            id: true
          }
        }
      }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this company
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

    return NextResponse.json({
      id: post.uuid,
      content: post.content,
      contentType: post.contentType,
      isPinned: post.isPinned,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
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
      })),
      links: post.links.map((l) => ({
        url: l.url,
        title: l.title,
        description: l.description,
        imageUrl: l.imageUrl,
        domain: l.domain
      })),
      isLikedByUser: post.likes.length > 0
    })
  } catch (error) {
    console.error('Error fetching post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/posts/[id]
 * Update a post (author only, or admin for pinning)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params
    const body = await request.json()

    const validated = updatePostSchema.parse(body)

    const post = await prisma.post.findUnique({
      where: { uuid: id }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const isAuthor = post.userId === auth.user.id
    const canEdit = isAuthor || auth.isAdmin

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Not authorized to edit this post' },
        { status: 403 }
      )
    }

    // If updating isPinned, require admin
    if (validated.isPinned !== undefined && !auth.isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can pin posts' },
        { status: 403 }
      )
    }

    // Update post
    const updated = await prisma.post.update({
      where: { uuid: id },
      data: {
        content: validated.content,
        isPinned: validated.isPinned
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
      id: updated.uuid,
      content: updated.content,
      contentType: updated.contentType,
      isPinned: updated.isPinned,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      user: {
        id: updated.user.id,
        username: updated.user.username ?? 'Unknown',
        name: updated.user.name ?? 'Unknown User',
        profilePicUrl: updated.user.profilePicUrl64 ?? ''
      },
      company: {
        id: updated.company.id,
        name: updated.company.name
      },
      media: updated.media.map((m) => ({
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height,
        altText: m.altText
      }))
    })
  } catch (error) {
    console.error('Error updating post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/[id]
 * Soft delete a post (author or admin only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params

    const post = await prisma.post.findUnique({
      where: { uuid: id }
    })

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check permissions (author or admin can delete)
    const isAuthor = post.userId === auth.user.id
    const canDelete = isAuthor || auth.isAdmin

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Not authorized to delete this post' },
        { status: 403 }
      )
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
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
