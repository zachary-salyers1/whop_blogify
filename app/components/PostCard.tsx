'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface Post {
  id: string
  title?: string
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
    mediaType?: string
  }[]
}

interface PostCardProps {
  post: Post
  onLike: (postId: string) => Promise<void>
  onUnlike: (postId: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onPin?: (postId: string) => Promise<void>
  canDelete?: boolean
  canPin?: boolean
  brandColor?: string
}

export function PostCard({ post, onLike, onUnlike, onDelete, onPin, canDelete, canPin, brandColor = '#3B82F6' }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLikedByUser)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isPinned, setIsPinned] = useState(post.isPinned)

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

  const handlePin = async () => {
    if (!onPin || isLoading) return
    setIsLoading(true)
    try {
      await onPin(post.id)
      setIsPinned(!isPinned)
    } catch (error) {
      console.error('Error pinning post:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow-md border-2 p-6 hover:shadow-lg transition-shadow" style={{ borderColor: brandColor }}>
      {isPinned && (
        <div className="flex items-center gap-2 mb-3 text-sm font-bold" style={{ color: brandColor }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c-.25.78-.03 1.632.57 2.212.617.596 1.536.837 2.4.63L8 15v2a1 1 0 102 0v-2.153L9.152 15.668c.864.207 1.783-.034 2.4-.63.599-.58.82-1.432.57-2.212l-.818-2.552a1 1 0 00-1.896.634l.818 2.552a1 1 0 01-.285.525.989.989 0 01-.667.333.989.989 0 01-.667-.333 1 1 0 01-.285-.525l-.818-2.552a1 1 0 00-1.896-.634z" />
          </svg>
          <span className="font-bold">Pinned</span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <img
          src={post.user.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.username}`}
          alt={post.user.name}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-black text-base">{post.user.name}</span>
            <span className="text-black font-bold text-sm">@{post.user.username}</span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${brandColor}15`,
                borderColor: brandColor,
                borderWidth: '1px',
                color: brandColor
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
              </svg>
              {post.company.name}
            </span>
          </div>
          <div className="text-sm text-black font-bold">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </div>
        </div>
        <div className="flex gap-2">
          {canPin && (
            <button
              onClick={handlePin}
              disabled={isLoading}
              className="text-sm font-bold disabled:opacity-50 transition-all"
              style={{ color: brandColor }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="text-red-700 hover:text-red-800 text-sm font-bold disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Blog Title */}
      {post.title && (
        <a href={`/posts/${post.id}`}>
          <h2
            className="text-2xl font-black text-black mb-3 transition-colors cursor-pointer"
            onMouseEnter={(e) => e.currentTarget.style.color = brandColor}
            onMouseLeave={(e) => e.currentTarget.style.color = 'black'}
          >
            {post.title}
          </h2>
        </a>
      )}

      {/* Blog Content Preview */}
      <div className="mb-4">
        <div className="prose prose-slate max-w-none text-black line-clamp-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {post.content.substring(0, 200)}
          </ReactMarkdown>
        </div>
        {post.content.length > 200 && (
          <a
            href={`/posts/${post.id}`}
            className="inline-block mt-2 font-bold transition-colors"
            style={{ color: brandColor }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.8)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Read more →
          </a>
        )}
      </div>

      {post.media && post.media.length > 0 && (
        <div className={`mb-4 grid gap-2 ${
          post.media.length === 1 ? 'grid-cols-1' :
          post.media.length === 2 ? 'grid-cols-2' :
          post.media.length === 3 ? 'grid-cols-3' :
          'grid-cols-2'
        }`}>
          {post.media.map((item, index) => (
            <div key={index} className="rounded-lg overflow-hidden">
              {item.mediaType === 'video' ? (
                <video
                  src={item.url}
                  controls
                  className="w-full h-full max-h-96 bg-black"
                />
              ) : (
                <img
                  src={item.thumbnailUrl || item.url}
                  alt=""
                  className="w-full h-full object-cover max-h-64"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-6 pt-4 border-t-2" style={{ borderColor: `${brandColor}40` }}>
        <button
          onClick={handleLike}
          disabled={isLoading}
          className="flex items-center gap-2 transition-colors disabled:opacity-50 font-bold"
          style={{ color: isLiked ? '#EF4444' : '#374151' }}
          onMouseEnter={(e) => !isLiked && (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={(e) => !isLiked && (e.currentTarget.style.color = '#374151')}
        >
          <svg
            className={`w-5 h-5 ${isLiked ? 'fill-red-600' : 'fill-none'}`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className={`text-sm font-bold ${isLiked ? 'text-red-600' : 'text-black'}`}>
            {likesCount}
          </span>
        </button>

        <a
          href={`/posts/${post.id}`}
          className="flex items-center gap-2 transition-colors font-bold"
          style={{ color: '#374151' }}
          onMouseEnter={(e) => e.currentTarget.style.color = brandColor}
          onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-bold text-black">{post.commentsCount}</span>
        </a>
      </div>
    </div>
  )
}
