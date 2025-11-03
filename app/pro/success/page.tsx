'use client'

import { useRouter } from 'next/navigation'

export default function ProSuccessPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8">
          <svg className="w-20 h-20 text-green-600 mx-auto mb-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>

          <h1 className="text-3xl font-black text-black mb-4">
            Welcome to Pro! 🎉
          </h1>

          <p className="text-gray-700 font-medium mb-6">
            Your subscription has been activated. You now have access to all Pro features including AI writing assistance, custom branding, and more!
          </p>

          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors mb-3"
          >
            Start Writing
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-black font-bold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Customize Branding
          </button>
        </div>
      </div>
    </div>
  )
}
