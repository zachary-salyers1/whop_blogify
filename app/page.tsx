'use client'

import { useEffect, useState, Suspense, useContext } from 'react'
import { PostCard } from './components/PostCard'
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
  canDelete: boolean
  canPin: boolean
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
  links?: {
    url: string
    title: string | null
    description: string | null
    imageUrl: string | null
    domain: string | null
  }[]
}

interface Community {
	id: string
	name: string
}

interface BrandingSettings {
	appName: string
	primaryColor: string
	logoUrl: string | null
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
	const [isPro, setIsPro] = useState(false)
	const [branding, setBranding] = useState<BrandingSettings>({
		appName: 'Community Feed',
		primaryColor: '#3B82F6',
		logoUrl: null
	})

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
			whopSdk.getTopLevelUrlData({}).then((topLevelData) => {
				console.log('[CLIENT] Top level URL data:', topLevelData)

				// The response has experienceId directly, no need to parse URL
				if (topLevelData && topLevelData.experienceId) {
					console.log('[CLIENT] Experience ID from SDK:', topLevelData.experienceId)
					localStorage.setItem('whop_experience_id', topLevelData.experienceId)
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

				// If there's only one community, auto-select it and fetch branding
				if (data.data.length === 1) {
					const firstCommunity = data.data[0]
					setSelectedCommunity(firstCommunity.id)
					fetchBranding(firstCommunity.id)
				}
			}
		} catch (err) {
			console.error('Failed to fetch communities:', err)
		}
	}

	const fetchBranding = async (communityId: string) => {
		try {
			const response = await fetch(`/api/admin/settings/${communityId}`)
			if (response.ok) {
				const data = await response.json()
				setBranding({
					appName: data.data.appName,
					primaryColor: data.data.primaryColor,
					logoUrl: data.data.logoUrl
				})
			}
		} catch (err) {
			console.error('Failed to fetch branding:', err)
			// Keep default branding on error
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
		checkProStatus()

		// Listen for branding updates from admin panel (cross-tab)
		const handleBrandingUpdate = (e: StorageEvent) => {
			if (e.key === 'branding_updated' && e.newValue) {
				try {
					const update = JSON.parse(e.newValue)
					// Only update if it's for the currently selected community
					if (update.companyId === selectedCommunity) {
						setBranding(update.branding)
					}
				} catch (err) {
					console.error('Error parsing branding update:', err)
				}
			}
		}

		// Check for branding updates when page becomes visible (same tab navigation)
		const handleVisibilityChange = () => {
			if (!document.hidden && selectedCommunity) {
				const brandingUpdate = localStorage.getItem('branding_updated')
				if (brandingUpdate) {
					try {
						const update = JSON.parse(brandingUpdate)
						// Check if update is recent (within last 5 seconds) and for current community
						if (update.companyId === selectedCommunity && (Date.now() - update.timestamp) < 5000) {
							setBranding(update.branding)
						}
					} catch (err) {
						console.error('Error checking branding update:', err)
					}
				}
			}
		}

		window.addEventListener('storage', handleBrandingUpdate)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			window.removeEventListener('storage', handleBrandingUpdate)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [selectedCommunity])

	const checkProStatus = async () => {
		try {
			const response = await fetch('/api/pro/status')
			if (response.ok) {
				const data = await response.json()
				setIsPro(data.isPro)
			}
		} catch (err) {
			console.error('Error checking Pro status:', err)
		}
	}

	const handleCommunityChange = (communityId: string) => {
		setSelectedCommunity(communityId)
		setPage(1)
		fetchPosts(1, communityId || undefined)

		// Fetch branding for the selected community
		if (communityId) {
			fetchBranding(communityId)
		} else {
			// Reset to default branding when "All Communities" is selected
			setBranding({
				appName: 'Community Feed',
				primaryColor: '#3B82F6',
				logoUrl: null
			})
		}
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

	const handleEdit = async (postId: string, title: string, content: string) => {
		const response = await fetch(`/api/posts/${postId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title, content })
		})
		if (response.ok) {
			// Refresh to show updated post
			fetchPosts(page, selectedCommunity || undefined)
		}
	}

	const loadMore = () => {
		const nextPage = page + 1
		setPage(nextPage)
		fetchPosts(nextPage, selectedCommunity || undefined)
	}

	return (
		<div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8" style={{ '--brand-color': branding.primaryColor } as React.CSSProperties}>
			<div className="max-w-2xl mx-auto">
				{/* Logo Banner */}
				{branding.logoUrl && (
					<div className="mb-6 rounded-lg overflow-hidden">
						<img
							src={branding.logoUrl}
							alt="Community Logo"
							className="w-full h-32 object-cover"
						/>
					</div>
				)}

				<div className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h1 className="text-3xl font-bold text-black mb-2">
								{branding.appName}
							</h1>
							<p className="text-black">
								Share updates and connect with your community
							</p>
						</div>
						<div className="flex items-center gap-3">
							{!isPro && (
								<a
									href="/pro"
									className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg transition-colors"
									style={{ backgroundColor: branding.primaryColor }}
									onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
									onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
									Upgrade to Pro
								</a>
							)}
							{isPro && (
								<div
									className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg"
									style={{ backgroundColor: branding.primaryColor }}
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
									Pro Member
								</div>
							)}
							<a
								href="/create"
								className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg transition-colors"
								style={{ backgroundColor: branding.primaryColor }}
								onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
								onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
								</svg>
								Write Blog
							</a>
							<a
								href="/search"
								className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg transition-colors"
								style={{ backgroundColor: branding.primaryColor }}
								onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
								onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
								Search
							</a>
							<a
								href="/admin"
								className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg transition-colors"
								style={{ backgroundColor: branding.primaryColor }}
								onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
								onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								Admin
							</a>
						</div>
					</div>

					{/* Community Filter */}
					{communities.length > 0 && (
						<div className="mt-4">
							<select
								value={selectedCommunity}
								onChange={(e) => handleCommunityChange(e.target.value)}
								className="w-full sm:w-auto px-4 py-2 border-2 rounded-lg text-black font-bold bg-white focus:outline-none focus:ring-2"
								style={{
									borderColor: branding.primaryColor,
									// @ts-ignore - CSS custom property
									'--tw-ring-color': branding.primaryColor
								}}
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
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: branding.primaryColor }}></div>
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
									onEdit={handleEdit}
									canDelete={post.canDelete}
									canPin={post.canPin}
									canEdit={post.canDelete}
									brandColor={branding.primaryColor}
								/>
							))}
						</div>

						{hasMore && (
							<div className="mt-6 text-center">
								<button
									onClick={loadMore}
									disabled={isLoading}
									className="px-6 py-3 text-white font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									style={{
										backgroundColor: branding.primaryColor,
										borderColor: branding.primaryColor
									}}
									onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
									onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
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
