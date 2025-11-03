import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAccess } from '@/lib/auth'

/**
 * GET /api/posts/:id
 * Get a single post by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth()

    const post = await prisma.post.findUnique({
      where: {
        id: BigInt(params.id),
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

    if (!post) {
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
      id: post.id.toString(),
      uuid: post.uuid,
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
        height: m.height
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
 * DELETE /api/posts/:id
 * Delete a post (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAccess()

    const post = await prisma.post.findUnique({
      where: {
        id: BigInt(params.id)
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user is the author or an admin in the company
    const isAuthor = post.userId === auth.user.id
    const isAdmin = auth.isAdmin && post.companyId === auth.companyId

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Soft delete
    await prisma.post.update({
      where: { id: BigInt(params.id) },
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
