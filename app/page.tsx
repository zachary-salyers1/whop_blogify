'use client'

import { useEffect, useState } from 'react'
import { PostCard } from './components/PostCard'
import { CreatePostForm } from './components/CreatePostForm'

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

export default function Page() {
	const [posts, setPosts] = useState<Post[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)

	const fetchPosts = async (pageNum: number = 1) => {
		try {
			setIsLoading(true)
			const response = await fetch(`/api/posts?page=${pageNum}&limit=20`)

			if (!response.ok) {
				throw new Error('Failed to fetch posts')
			}

			const data = await response.json()

			if (pageNum === 1) {
				setPosts(data.data)
			} else {
				setPosts(prev => [...prev, ...data.data])
			}

			setHasMore(data.pagination.page < data.pagination.totalPages)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load posts')
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		fetchPosts(1)
	}, [])

	const handleLike = async (postId: string) => {
		await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
	}

	const handleUnlike = async (postId: string) => {
		await fetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
	}

	const handleDelete = async (postId: string) => {
		await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
		setPosts(prev => prev.filter(p => p.id !== postId))
	}

	const handlePostCreated = () => {
		fetchPosts(1)
		setPage(1)
	}

	const loadMore = () => {
		const nextPage = page + 1
		setPage(nextPage)
		fetchPosts(nextPage)
	}

	return (
		<div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-2xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-black mb-2">
						Community Feed
					</h1>
					<p className="text-black">
						Share updates and connect with your community
					</p>
				</div>

				<CreatePostForm onPostCreated={handlePostCreated} />

				{error && (
					<div className="bg-red-50 border-2 border-red-300 text-black px-6 py-4 rounded-lg mb-6">
						<h3 className="font-black text-lg mb-2">⚠️ Error</h3>
						<p className="font-bold">{error}</p>
						{error.includes('Failed to fetch') && (
							<p className="mt-3 text-sm font-bold">
								💡 This app must be accessed through Whop. If you're seeing this error, please access the app from your Whop company dashboard where you installed Blogify.
							</p>
						)}
					</div>
				)}

				{isLoading && posts.length === 0 ? (
					<div className="text-center py-12">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						<p className="mt-4 text-black font-medium">Loading posts...</p>
					</div>
				) : posts.length === 0 ? (
					<div className="text-center py-12 bg-gray-50 rounded-lg shadow-sm border border-gray-300">
						<svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
						</svg>
						<h3 className="mt-4 text-lg font-bold text-black">No posts yet</h3>
						<p className="mt-2 text-black">Be the first to share something!</p>
					</div>
				) : (
					<>
						<div className="space-y-6">
							{posts.map((post) => (
								<PostCard
									key={post.id}
									post={post}
									onLike={handleLike}
									onUnlike={handleUnlike}
									onDelete={handleDelete}
									canDelete={true}
								/>
							))}
						</div>

						{hasMore && (
							<div className="mt-6 text-center">
								<button
									onClick={loadMore}
									disabled={isLoading}
									className="px-6 py-3 bg-blue-600 border border-blue-700 text-white font-bold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{isLoading ? 'Loading...' : 'Load More'}
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
