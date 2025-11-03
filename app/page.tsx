'use client'

import { useEffect, useState, Suspense, useContext } from 'react'
import { PostCard } from './components/PostCard'
import { CreatePostForm } from './components/CreatePostForm'
import { useSearchParams } from 'next/navigation'
import { WhopIframeSdkContext } from '@whop/react/iframe'

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

interface Community {
	id: string
	name: string
}

function FeedContent() {
	const searchParams = useSearchParams()
	const whopSdk = useContext(WhopIframeSdkContext)
	const [posts, setPosts] = useState<Post[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [communities, setCommunities] = useState<Community[]>([])
	const [selectedCommunity, setSelectedCommunity] = useState<string>('')

	// Log all query parameters and SDK context
	useEffect(() => {
		const params = Object.fromEntries(searchParams.entries())
		console.log('[CLIENT] URL query parameters:', params)
		console.log('[CLIENT] window.location:', {
			href: window.location.href,
			search: window.location.search,
			pathname: window.location.pathname
		})

		// Log Whop SDK context
		console.log('[CLIENT] Whop SDK context:', whopSdk)
		if (whopSdk) {
			console.log('[CLIENT] SDK keys:', Object.keys(whopSdk))

			// Call getTopLevelUrlData to get parent URL with experience ID
			whopSdk.getTopLevelUrlData().then((topLevelData) => {
				console.log('[CLIENT] Top level URL data:', topLevelData)

				if (topLevelData && topLevelData.href) {
					// Extract experience ID from parent URL
					const match = topLevelData.href.match(/\/exp_([a-zA-Z0-9]+)\//)
					if (match) {
						const experienceId = `exp_${match[1]}`
						console.log('[CLIENT] Extracted experience ID from SDK:', experienceId)

						// Store in localStorage to pass to API requests
						localStorage.setItem('whop_experience_id', experienceId)
					}
				}
			}).catch((err) => {
				console.error('[CLIENT] Failed to get top level URL data:', err)
			})
		}
	}, [searchParams, whopSdk])

	const fetchCommunities = async () => {
		try {
			const response = await fetch('/api/user/communities')
			if (response.ok) {
				const data = await response.json()
				setCommunities(data.data)
			}
		} catch (err) {
			console.error('Failed to fetch communities:', err)
		}
	}

	const fetchPosts = async (pageNum: number = 1, communityId?: string) => {
		try {
			setIsLoading(true)
			const url = communityId
				? `/api/posts?page=${pageNum}&limit=20&companyId=${communityId}`
				: `/api/posts?page=${pageNum}&limit=20`
			const response = await fetch(url)

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
		fetchCommunities()
		fetchPosts(1)
	}, [])

	const handleCommunityChange = (communityId: string) => {
		setSelectedCommunity(communityId)
		setPage(1)
		fetchPosts(1, communityId || undefined)
	}

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

	const handlePin = async (postId: string) => {
		const response = await fetch(`/api/posts/${postId}/pin`, { method: 'POST' })
		if (response.ok) {
			// Refresh to show new pin state and reorder
			fetchPosts(page, selectedCommunity || undefined)
		}
	}

	const handlePostCreated = () => {
		fetchPosts(1)
		setPage(1)
	}

	const loadMore = () => {
		const nextPage = page + 1
		setPage(nextPage)
		fetchPosts(nextPage, selectedCommunity || undefined)
	}

	return (
		<div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-2xl mx-auto">
				<div className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h1 className="text-3xl font-bold text-black mb-2">
								Community Feed
							</h1>
							<p className="text-black">
								Share updates and connect with your community
							</p>
						</div>
					</div>

					{/* Community Filter */}
					{communities.length > 0 && (
						<div className="mt-4">
							<select
								value={selectedCommunity}
								onChange={(e) => handleCommunityChange(e.target.value)}
								className="w-full sm:w-auto px-4 py-2 border-2 border-gray-400 rounded-lg text-black font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								{communities.length > 1 && <option value="">All Communities</option>}
								{communities.map((community) => (
									<option key={community.id} value={community.id}>
										{community.name}
									</option>
								))}
							</select>
						</div>
					)}
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
									onPin={handlePin}
									canDelete={true}
									canPin={true}
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

export default function Page() {
	return (
		<Suspense fallback={
			<div className="min-h-screen bg-white py-8 px-4 flex items-center justify-center">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<p className="mt-4 text-black font-medium">Loading...</p>
				</div>
			</div>
		}>
			<FeedContent />
		</Suspense>
	);
}
