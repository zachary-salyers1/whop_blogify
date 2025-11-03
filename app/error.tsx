'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-red-50 border-2 border-red-300 rounded-lg p-6">
        <h2 className="text-2xl font-black text-black mb-4">⚠️ Something went wrong!</h2>
        <p className="text-black font-bold mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
