'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProPage() {
  const router = useRouter()
  const [isPro, setIsPro] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkProStatus()
  }, [])

  const checkProStatus = async () => {
    try {
      const response = await fetch('/api/pro/status')
      if (response.ok) {
        const data = await response.json()
        setIsPro(data.isPro)
      }
    } catch (err) {
      console.error('Error checking Pro status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    setError('')

    try {
      const response = await fetch('/api/pro/checkout', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout')
      }

      const data = await response.json()

      // Redirect to Whop checkout
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start upgrade')
      setIsUpgrading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-black font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (isPro) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8">
            <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-3xl font-black text-black mb-2">You're a Pro!</h1>
            <p className="text-gray-700 font-medium mb-6">
              You have access to all Pro features including AI writing assistance, custom branding, and more.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-black mb-4">
            Upgrade to Blogify Pro
          </h1>
          <p className="text-xl text-gray-700 font-medium">
            Unlock premium features for just $4.99/month
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Free Plan */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-8">
            <h2 className="text-2xl font-black text-black mb-4">Free Plan</h2>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-black font-medium">Create unlimited blogs</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-black font-medium">Markdown formatting</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-black font-medium">Image & video uploads</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-black font-medium">Comments & likes</span>
              </li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white border-2 border-purple-700 rounded-lg p-8 relative">
            <div className="absolute top-4 right-4 bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-full">
              POPULAR
            </div>
            <h2 className="text-2xl font-black mb-2">Pro Plan</h2>
            <div className="text-4xl font-black mb-6">
              $4.99<span className="text-lg font-medium">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Everything in Free</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">AI Writing Assistant</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Custom Branding (colors, banner)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Advanced posting controls</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Priority support</span>
              </li>
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="w-full px-6 py-4 bg-white text-purple-600 font-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {isUpgrading ? 'Processing...' : 'Upgrade to Pro'}
            </button>

            {error && (
              <p className="mt-4 text-red-200 text-sm font-medium text-center">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-gray-700 hover:text-black font-bold"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
