'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface CreatePostFormProps {
  onPostCreated: () => void
}

interface UploadedImage {
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  fileSize?: number
  mimeType?: string
  altText?: string
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (images.length >= 4) {
      setError('Maximum 4 images per post')
      return
    }

    const remainingSlots = 4 - images.length
    const filesToUpload = acceptedFiles.slice(0, remainingSlots)

    setUploadingImage(true)
    setError('')

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to upload image')
        }

        return await response.json()
      })

      const uploadedImages = await Promise.all(uploadPromises)
      setImages((prev) => [...prev, ...uploadedImages])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images')
    } finally {
      setUploadingImage(false)
    }
  }, [images.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    disabled: isLoading || uploadingImage || images.length >= 4
  })

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setError('Please write something')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Get experience ID from localStorage (set by SDK)
      const experienceId = localStorage.getItem('whop_experience_id')

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(experienceId && { 'X-Whop-Experience-Id': experienceId })
        },
        body: JSON.stringify({
          content: content.trim(),
          contentType: images.length > 0 ? 'image' : 'text',
          images: images.length > 0 ? images : undefined
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create post')
      }

      setContent('')
      setImages([])
      onPostCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow-md border-2 border-gray-300 p-6 mb-6">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[120px] p-3 border-2 border-gray-400 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-medium bg-white placeholder-gray-500"
          disabled={isLoading}
          maxLength={5000}
        />

        {/* Image Upload Area */}
        {images.length < 4 && (
          <div
            {...getRootProps()}
            className={`mt-4 p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-400 hover:border-blue-400 bg-white'
            } ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="text-black font-bold">
              {uploadingImage ? (
                <span>Uploading...</span>
              ) : isDragActive ? (
                <span>Drop images here...</span>
              ) : (
                <span>📷 Click or drag to add images ({images.length}/4)</span>
              )}
            </div>
            <div className="text-sm text-gray-700 font-medium mt-1">
              JPG, PNG, GIF, WEBP • Max 10MB per image
            </div>
          </div>
        )}

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image.url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-red-600 text-white font-black rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-2 text-sm text-red-700 font-bold">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-black font-bold">
            {content.length} / 5000
          </div>
          <button
            type="submit"
            disabled={isLoading || uploadingImage || !content.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-black text-base rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isLoading ? 'Posting...' : uploadingImage ? 'Uploading...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
