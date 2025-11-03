import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * DELETE /api/comments/:id
 * Delete a comment (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth()

    const comment = await prisma.comment.findUnique({
      where: {
        id: BigInt(params.id)
      },
      include: {
        post: {
          select: {
            companyId: true
          }
        }
      }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Check if user is the comment author or an admin
    const isAuthor = comment.userId === auth.user.id
    const isAdmin = auth.isAdmin && comment.post.companyId === auth.companyId

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Soft delete
    await prisma.comment.update({
      where: { id: BigInt(params.id) },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    })

    // Decrement post comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: {
        commentsCount: {
          decrement: 1
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
