'use client'

import { useState } from 'react'

interface CreatePostFormProps {
  onPostCreated: () => void
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setError('Please write something')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          contentType: 'text'
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create post')
      }

      setContent('')
      onPostCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
          maxLength={5000}
        />

        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {content.length} / 5000
          </div>
          <button
            type="submit"
            disabled={isLoading || !content.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
