'use client'

import { useState, useEffect } from 'react'

interface BrandingSettings {
  companyId: string
  companyName: string
  appName: string
  primaryColor: string
  logoUrl: string | null
  postingPermission: 'all_members' | 'admins_only'
}

interface Analytics {
  overview: {
    totalPosts: number
    totalLikes: number
    totalComments: number
    activeUsers7d: number
    activeUsers30d: number
  }
  activity: {
    posts7d: number
    posts30d: number
    avgPostsPerDay7d: number
    avgPostsPerDay30d: number
  }
  topPosters: Array<{
    userId: string
    username: string
    name: string
    profilePicUrl: string | null
    postCount: number
  }>
  recentPosts: Array<{
    id: string
    title: string | null
    content: string
    createdAt: string
    likesCount: number
    commentsCount: number
    user: {
      id: string
      username: string
      name: string
    }
  }>
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'branding' | 'analytics'>('branding')
  const [companyId, setCompanyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  // Branding state
  const [settings, setSettings] = useState<BrandingSettings | null>(null)
  const [appName, setAppName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [logoUrl, setLogoUrl] = useState('')
  const [postingPermission, setPostingPermission] = useState<'all_members' | 'admins_only'>('all_members')

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Get companyId from localStorage (set by main page)
  useEffect(() => {
    const fetchUserCommunities = async () => {
      try {
        const response = await fetch('/api/user/communities')
        if (response.ok) {
          const data = await response.json()
          if (data.data && data.data.length > 0) {
            // Use the first community the user has access to
            const firstCommunity = data.data[0]
            setCompanyId(firstCommunity.id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch communities:', err)
      }
    }

    fetchUserCommunities()
  }, [])

  // Fetch branding settings when companyId is available
  useEffect(() => {
    if (companyId) {
      fetchSettings()
    }
  }, [companyId])

  const fetchSettings = async () => {
    if (!companyId) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/settings/${companyId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }

      const data = await response.json()
      setSettings(data.data)
      setAppName(data.data.appName)
      setPrimaryColor(data.data.primaryColor)
      setLogoUrl(data.data.logoUrl || '')
      setPostingPermission(data.data.postingPermission)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    if (!companyId) return

    setLoadingAnalytics(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/stats/${companyId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalytics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  // Fetch analytics when switching to analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && companyId && !analytics) {
      fetchAnalytics()
    }
  }, [activeTab, companyId])

  const handleSaveSettings = async () => {
    if (!companyId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/admin/settings/${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appName,
          primaryColor,
          logoUrl: logoUrl || undefined,
          postingPermission
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      const data = await response.json()
      setSettings(data.data)
      setSuccess('Settings saved successfully!')

      // Broadcast branding update to other tabs/windows
      localStorage.setItem('branding_updated', JSON.stringify({
        companyId: companyId,
        timestamp: Date.now(),
        branding: {
          appName: data.data.appName,
          primaryColor: data.data.primaryColor,
          logoUrl: data.data.logoUrl
        }
      }))

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const brandColor = settings?.primaryColor || '#3B82F6'

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }}></div>
          <p className="mt-4 text-black font-medium">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
            <h3 className="text-lg font-bold text-yellow-900 mb-2">No Community Access</h3>
            <p className="text-yellow-800 font-medium">
              You don't have admin access to any communities. Please contact your community owner.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-gray-300 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-black">Admin Panel</h1>
              {settings && (
                <p className="text-gray-700 font-medium mt-1">{settings.companyName}</p>
              )}
            </div>
            <a
              href="/"
              className="px-4 py-2 text-white font-bold rounded-lg transition-colors"
              style={{ backgroundColor: brandColor }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              Back to Feed
            </a>
          </div>

          {/* Tabs */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${
                activeTab === 'branding'
                  ? 'bg-white border-t-2 border-x-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={activeTab === 'branding' ? { color: brandColor, borderColor: brandColor } : {}}
            >
              🎨 Branding
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-white border-t-2 border-x-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={activeTab === 'analytics' ? { color: brandColor, borderColor: brandColor } : {}}
            >
              📊 Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-bold">{success}</p>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg border-2 p-6" style={{ borderColor: brandColor }}>
              <h2 className="text-2xl font-black text-black mb-6">Display Settings</h2>

              <div className="space-y-6">
                {/* App Name */}
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    App Display Name
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Community Blog"
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg text-black font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={100}
                  />
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    This name will appear in your community's blog app
                  </p>
                </div>

                {/* Primary Color */}
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-12 w-24 rounded-lg cursor-pointer border-2 border-gray-400"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="flex-1 px-4 py-2 border-2 border-gray-400 rounded-lg text-black font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    Choose a color that matches your brand
                  </p>
                </div>

                {/* Logo URL */}
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg text-black font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    Direct URL to your community logo image
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border-2 p-6" style={{ borderColor: brandColor }}>
              <h2 className="text-2xl font-black text-black mb-6">Permissions</h2>

              <div>
                <label className="block text-sm font-bold text-black mb-3">
                  Who Can Post?
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="postingPermission"
                      value="all_members"
                      checked={postingPermission === 'all_members'}
                      onChange={(e) => setPostingPermission(e.target.value as 'all_members' | 'admins_only')}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div>
                      <div className="text-black font-bold">All Members</div>
                      <div className="text-sm text-gray-600 font-medium">
                        Anyone in your community can create posts
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="postingPermission"
                      value="admins_only"
                      checked={postingPermission === 'admins_only'}
                      onChange={(e) => setPostingPermission(e.target.value as 'all_members' | 'admins_only')}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div>
                      <div className="text-black font-bold">Admins Only</div>
                      <div className="text-sm text-gray-600 font-medium">
                        Only admins and owners can create posts
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={fetchSettings}
                className="px-6 py-3 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-3 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: brandColor }}
                onMouseEnter={(e) => !saving && (e.currentTarget.style.filter = 'brightness(0.9)')}
                onMouseLeave={(e) => !saving && (e.currentTarget.style.filter = 'brightness(1)')}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {loadingAnalytics ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-black font-medium">Loading analytics...</p>
              </div>
            ) : analytics ? (
              <>
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-blue-50 rounded-lg border-2 border-blue-300 p-6">
                    <div className="text-blue-600 font-bold text-sm mb-2">Total Posts</div>
                    <div className="text-3xl font-black text-black">{analytics.overview.totalPosts.toLocaleString()}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg border-2 border-red-300 p-6">
                    <div className="text-red-600 font-bold text-sm mb-2">Total Likes</div>
                    <div className="text-3xl font-black text-black">{analytics.overview.totalLikes.toLocaleString()}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg border-2 border-green-300 p-6">
                    <div className="text-green-600 font-bold text-sm mb-2">Total Comments</div>
                    <div className="text-3xl font-black text-black">{analytics.overview.totalComments.toLocaleString()}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg border-2 border-purple-300 p-6">
                    <div className="text-purple-600 font-bold text-sm mb-2">Active (7d)</div>
                    <div className="text-3xl font-black text-black">{analytics.overview.activeUsers7d.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg border-2 border-orange-300 p-6">
                    <div className="text-orange-600 font-bold text-sm mb-2">Active (30d)</div>
                    <div className="text-3xl font-black text-black">{analytics.overview.activeUsers30d.toLocaleString()}</div>
                  </div>
                </div>

                {/* Activity Stats */}
                <div className="bg-gray-50 rounded-lg border-2 p-6" style={{ borderColor: brandColor }}>
                  <h2 className="text-xl font-black text-black mb-4">Recent Activity</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-gray-600 font-bold text-sm mb-1">Posts (7 days)</div>
                      <div className="text-2xl font-black text-black">{analytics.activity.posts7d}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 font-bold text-sm mb-1">Posts (30 days)</div>
                      <div className="text-2xl font-black text-black">{analytics.activity.posts30d}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 font-bold text-sm mb-1">Avg/Day (7d)</div>
                      <div className="text-2xl font-black text-black">{analytics.activity.avgPostsPerDay7d}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 font-bold text-sm mb-1">Avg/Day (30d)</div>
                      <div className="text-2xl font-black text-black">{analytics.activity.avgPostsPerDay30d}</div>
                    </div>
                  </div>
                </div>

                {/* Top Posters */}
                <div className="bg-gray-50 rounded-lg border-2 p-6" style={{ borderColor: brandColor }}>
                  <h2 className="text-xl font-black text-black mb-4">Top Posters</h2>
                  {analytics.topPosters.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topPosters.map((poster, index) => (
                        <div key={poster.userId} className="flex items-center gap-4 bg-white rounded-lg p-4 border" style={{ borderColor: `${brandColor}40` }}>
                          <div className="text-2xl font-black text-gray-400">#{index + 1}</div>
                          <div className="flex-1">
                            <div className="font-bold text-black">{poster.name}</div>
                            <div className="text-sm text-gray-600 font-medium">@{poster.username}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-black text-black">{poster.postCount}</div>
                            <div className="text-sm text-gray-600 font-medium">posts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 font-medium">No posts yet</p>
                  )}
                </div>

                {/* Recent Posts */}
                <div className="bg-gray-50 rounded-lg border-2 p-6" style={{ borderColor: brandColor }}>
                  <h2 className="text-xl font-black text-black mb-4">Recent Posts</h2>
                  {analytics.recentPosts.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.recentPosts.map((post) => (
                        <a
                          key={post.id}
                          href={`/posts/${post.id}`}
                          className="block bg-white rounded-lg p-4 border transition-colors"
                          style={{ borderColor: `${brandColor}40` }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = brandColor}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = `${brandColor}40`}
                        >
                          {post.title && (
                            <div className="font-bold text-black mb-1">{post.title}</div>
                          )}
                          <div className="text-sm text-gray-700 font-medium mb-2">{post.content}</div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <div className="font-medium">
                              by {post.user.name} • {formatDate(post.createdAt)}
                            </div>
                            <div className="flex items-center gap-3 font-bold">
                              <span>❤️ {post.likesCount}</span>
                              <span>💬 {post.commentsCount}</span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 font-medium">No posts yet</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={fetchAnalytics}
                    className="px-6 py-3 text-white font-bold rounded-lg transition-colors"
                    style={{ backgroundColor: brandColor }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Refresh Analytics
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2" style={{ borderColor: brandColor }}>
                <p className="text-gray-600 font-medium mb-4">No analytics data available</p>
                <button
                  onClick={fetchAnalytics}
                  className="px-6 py-3 text-white font-bold rounded-lg transition-colors"
                  style={{ backgroundColor: brandColor }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                >
                  Load Analytics
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
