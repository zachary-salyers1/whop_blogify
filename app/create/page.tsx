'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'

interface UploadedImage {
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  fileSize?: number
  mimeType?: string
  altText?: string
}

interface UploadedVideo {
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  fileSize?: number
  mimeType?: string
  duration?: number
}

export default function CreateBlogPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [videos, setVideos] = useState<UploadedVideo[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState('')
  const [isDraft, setIsDraft] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (images.length >= 4) {
      setError('Maximum 4 images per blog')
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
    disabled: uploadingImage || images.length >= 4
  })

  const onVideoDrop = useCallback(async (acceptedFiles: File[]) => {
    if (videos.length >= 1) {
      setError('Maximum 1 video per blog')
      return
    }

    setUploadingVideo(true)
    setError('')

    try {
      const file = acceptedFiles[0]
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload video')
      }

      const uploadedVideo = await response.json()
      setVideos([uploadedVideo])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video')
    } finally {
      setUploadingVideo(false)
    }
  }, [videos.length])

  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
    onDrop: onVideoDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/quicktime': ['.mov']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false,
    disabled: uploadingVideo || videos.length >= 1
  })

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeVideo = () => {
    setVideos([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Please add a title for your blog')
      return
    }

    if (!content.trim()) {
      setError('Please write some content')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Get experience ID from localStorage
      const experienceId = localStorage.getItem('whop_experience_id')

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(experienceId && { 'X-Whop-Experience-Id': experienceId })
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          contentType: videos.length > 0 ? 'video' : (images.length > 0 ? 'image' : 'text'),
          images: images.length > 0 ? images : undefined,
          videos: videos.length > 0 ? videos : undefined
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create blog')
      }

      // Redirect to feed on success
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blog')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (title.trim() || content.trim() || images.length > 0 || videos.length > 0) {
      if (confirm('Are you sure you want to discard this blog?')) {
        router.back()
      }
    } else {
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-gray-300 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="text-gray-700 hover:text-gray-900 font-bold"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-black">Create Blog</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-700 font-bold hidden sm:block">
              {title.length}/200 · {content.length}/50000
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || uploadingImage || !title.trim() || !content.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <p className="text-red-800 font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Blog Title"
              className="w-full text-4xl font-black text-black placeholder-gray-400 border-none focus:outline-none focus:ring-0 p-0"
              maxLength={200}
              autoFocus
              disabled={isSubmitting}
            />
            <div className="mt-2 text-sm text-gray-600 font-bold">
              {title.length}/200 characters
            </div>
          </div>

          {/* Content Textarea */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your blog content here... Share your thoughts, ideas, or stories with your community. Supports Markdown formatting."
              className="w-full min-h-[400px] text-lg text-black placeholder-gray-400 border-none focus:outline-none focus:ring-0 p-0 resize-none font-medium leading-relaxed"
              maxLength={50000}
              disabled={isSubmitting}
            />
            <div className="mt-2 text-sm text-gray-600 font-bold">
              {content.length}/50000 characters · Markdown supported
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-black text-black mb-4">Media</h3>

            {images.length < 4 && (
              <div
                {...getRootProps()}
                className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-400 hover:border-blue-400 bg-gray-50'
                } ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {uploadingImage ? (
                    <p className="text-black font-bold">Uploading...</p>
                  ) : isDragActive ? (
                    <p className="text-black font-bold">Drop images here</p>
                  ) : (
                    <>
                      <p className="text-black font-bold text-lg">
                        Click or drag to add images ({images.length}/4)
                      </p>
                      <p className="text-sm text-gray-700 font-medium">
                        JPG, PNG, GIF, WEBP • Max 10MB per image
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border-2 border-gray-300">
                    <img
                      src={image.url}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Video Upload Section */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-black text-black mb-4">Video (Optional)</h3>

            {videos.length < 1 && (
              <div
                {...getVideoRootProps()}
                className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                  isVideoDragActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-400 hover:border-purple-400 bg-gray-50'
                } ${uploadingVideo ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getVideoInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {uploadingVideo ? (
                    <p className="text-black font-bold">Uploading video...</p>
                  ) : isVideoDragActive ? (
                    <p className="text-black font-bold">Drop video here</p>
                  ) : (
                    <>
                      <p className="text-black font-bold text-lg">
                        Click or drag to add a video
                      </p>
                      <p className="text-sm text-gray-700 font-medium">
                        MP4, WEBM, MOV • Max 100MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Video Preview */}
            {videos.length > 0 && (
              <div className="mt-6">
                <div className="relative group rounded-lg overflow-hidden border-2 border-gray-300">
                  <video
                    src={videos[0].url}
                    controls
                    className="w-full max-h-96 bg-black"
                  />
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="absolute top-2 right-2 bg-red-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tips Section */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-lg font-black text-black mb-3">Writing Tips</h3>
            <ul className="space-y-2 text-sm text-gray-700 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Write a clear, descriptive title that captures your blog's main idea</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Break your content into paragraphs for better readability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Add images to make your blog more engaging (up to 4 images)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Proofread before publishing to catch any typos</span>
              </li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  )
}
