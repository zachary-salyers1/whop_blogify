export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-black text-black mb-4">404</h1>
        <h2 className="text-2xl font-black text-black mb-4">Page Not Found</h2>
        <p className="text-black font-bold mb-6">
          This page doesn't exist or you don't have access to it.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
