import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAccess } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/comments/[id]
 * Delete a comment (author or admin only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAccess()
    const { id } = await context.params

    const comment = await prisma.comment.findUnique({
      where: { uuid: id },
      include: {
        post: {
          select: {
            id: true,
            companyId: true
          }
        }
      }
    })

    if (!comment || comment.isDeleted) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Check permissions (author or admin can delete)
    const isAuthor = comment.userId === auth.user.id
    const canDelete = isAuthor || auth.isAdmin

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403 }
      )
    }

    // Soft delete comment and update counts
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { uuid: id },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      })

      // Update post comment count
      await tx.post.update({
        where: { id: comment.postId },
        data: {
          commentsCount: {
            decrement: 1
          }
        }
      })

      // Update parent comment reply count if this is a reply
      if (comment.parentCommentId) {
        await tx.comment.update({
          where: { id: comment.parentCommentId },
          data: {
            repliesCount: {
              decrement: 1
            }
          }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
