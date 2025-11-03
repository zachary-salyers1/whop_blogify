'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PostCard } from '@/app/components/PostCard'
import { Suspense } from 'react'

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
  }[]
}

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryParam = searchParams.get('q') || ''

  const [searchQuery, setSearchQuery] = useState(queryParam)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (queryParam) {
      performSearch(queryParam)
    }
  }, [queryParam])

  const performSearch = async (query: string) => {
    if (!query.trim()) return

    setIsLoading(true)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setPosts(data.data || [])
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleLike = async (postId: string) => {
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
    // Refresh search results
    if (queryParam) {
      performSearch(queryParam)
    }
  }

  const handleUnlike = async (postId: string) => {
    await fetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
    // Refresh search results
    if (queryParam) {
      performSearch(queryParam)
    }
  }

  const handleDelete = async (postId: string) => {
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    // Refresh search results
    if (queryParam) {
      performSearch(queryParam)
    }
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-blue-700 hover:text-blue-800 font-bold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Feed
          </button>

          <h1 className="text-3xl font-black text-black mb-4">Search Blogs</h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title..."
                className="flex-1 p-3 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium bg-white placeholder-gray-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="px-6 py-3 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600 font-bold">Searching...</p>
          </div>
        )}

        {!isLoading && hasSearched && posts.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-gray-300">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-xl font-bold text-gray-700">No blogs found</p>
            <p className="text-gray-600 font-medium mt-2">Try a different search term</p>
          </div>
        )}

        {!isLoading && posts.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-gray-700 mb-4">
              Found {posts.length} {posts.length === 1 ? 'blog' : 'blogs'}
            </p>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onUnlike={handleUnlike}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {!hasSearched && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-gray-300">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-xl font-bold text-gray-700">Search for blogs by title</p>
            <p className="text-gray-600 font-medium mt-2">Enter a search term above to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
