'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

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
  firstImage?: {
    url: string
    thumbnailUrl?: string
    width?: number
    height?: number
  } | null
}

interface PostCardProps {
  post: Post
  onLike: (postId: string) => Promise<void>
  onUnlike: (postId: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  canDelete?: boolean
}

export function PostCard({ post, onLike, onUnlike, onDelete, canDelete }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLikedByUser)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [isLoading, setIsLoading] = useState(false)

  const handleLike = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      if (isLiked) {
        await onUnlike(post.id)
        setIsLiked(false)
        setLikesCount(prev => prev - 1)
      } else {
        await onLike(post.id)
        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !confirm('Are you sure you want to delete this post?')) return
    setIsLoading(true)
    try {
      await onDelete(post.id)
    } catch (error) {
      console.error('Error deleting post:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {post.isPinned && (
        <div className="flex items-center gap-2 mb-3 text-sm text-blue-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c-.25.78-.03 1.632.57 2.212.617.596 1.536.837 2.4.63L8 15v2a1 1 0 102 0v-2.153L9.152 15.668c.864.207 1.783-.034 2.4-.63.599-.58.82-1.432.57-2.212l-.818-2.552a1 1 0 00-1.896.634l.818 2.552a1 1 0 01-.285.525.989.989 0 01-.667.333.989.989 0 01-.667-.333 1 1 0 01-.285-.525l-.818-2.552a1 1 0 00-1.896-.634z" />
          </svg>
          <span className="font-medium">Pinned</span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <img
          src={post.user.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.username}`}
          alt={post.user.name}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{post.user.name}</span>
            <span className="text-gray-500">@{post.user.username}</span>
          </div>
          <div className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="text-gray-900 whitespace-pre-wrap break-words">{post.content}</p>
      </div>

      {post.firstImage && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img
            src={post.firstImage.thumbnailUrl || post.firstImage.url}
            alt=""
            className="w-full h-auto max-h-96 object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-6 pt-4 border-t border-gray-200">
        <button
          onClick={handleLike}
          disabled={isLoading}
          className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-5 h-5 ${isLiked ? 'fill-red-600 text-red-600' : 'fill-none'}`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className={`text-sm font-medium ${isLiked ? 'text-red-600' : ''}`}>
            {likesCount}
          </span>
        </button>

        <a
          href={`/posts/${post.id}`}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">{post.commentsCount}</span>
        </a>
      </div>
    </div>
  )
}
