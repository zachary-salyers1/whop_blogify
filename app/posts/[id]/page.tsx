'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PostCard } from '@/app/components/PostCard'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    username: string
    name: string
    profilePicUrl: string
  }
  replies?: Comment[]
}

interface Post {
  id: string
  content: string
  contentType: string
  isPinned: boolean
  likesCount: number
  commentsCount: number
  createdAt: string
  isLikedByUser: boolean
  user: {
    id: string
    username: string
    name: string
    profilePicUrl: string
  }
  company: {
    id: string
    name: string
  }
  media?: {
    url: string
    thumbnailUrl?: string
    width?: number
    height?: number
  }[]
}

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPostAndComments()
  }, [params.id])

  const fetchPostAndComments = async () => {
    try {
      setIsLoading(true)

      // Fetch post
      const postRes = await fetch(`/api/posts/${params.id}`)
      if (!postRes.ok) {
        throw new Error('Post not found')
      }
      const postData = await postRes.json()
      setPost(postData)

      // Fetch comments
      const commentsRes = await fetch(`/api/posts/${params.id}/comments`)
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json()
        setComments(commentsData.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLike = async (postId: string) => {
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
  }

  const handleUnlike = async (postId: string) => {
    await fetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/posts/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() })
      })

      if (!response.ok) {
        throw new Error('Failed to post comment')
      }

      setNewComment('')
      await fetchPostAndComments() // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }

      await fetchPostAndComments() // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-24 mb-6"></div>
            <div className="bg-gray-300 rounded-lg h-64"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-800 font-bold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Feed
          </button>
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <p className="text-red-800 font-bold">{error || 'Post not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-800 font-bold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Feed
        </button>

        {/* Post */}
        <PostCard
          post={post}
          onLike={handleLike}
          onUnlike={handleUnlike}
        />

        {/* Comments Section */}
        <div className="mt-6 bg-gray-50 rounded-lg border-2 border-gray-300 p-6">
          <h2 className="text-xl font-black text-black mb-4">
            Comments ({comments.length})
          </h2>

          {/* Add Comment Form */}
          <form onSubmit={handleSubmitComment} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full min-h-[100px] p-3 border-2 border-gray-400 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium bg-white placeholder-gray-500"
              disabled={isSubmitting}
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-black font-bold">
                {newComment.length} / 2000
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-lg p-3">
              <p className="text-red-800 font-bold text-sm">{error}</p>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-gray-600 font-medium py-8">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onDelete={handleDeleteComment}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentCard({ comment, onDelete }: { comment: Comment; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <img
          src={comment.user.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user.username}`}
          alt={comment.user.name}
          className="w-8 h-8 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-black text-sm">{comment.user.name}</span>
            <span className="text-gray-600 font-bold text-xs">@{comment.user.username}</span>
            <span className="text-gray-600 font-medium text-xs">·</span>
            <span className="text-gray-600 font-medium text-xs">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-black font-medium text-sm whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>
        <button
          onClick={() => onDelete(comment.id)}
          className="text-gray-500 hover:text-red-600 text-xs font-bold"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
