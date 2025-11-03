'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/admin/sync-companies', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync companies')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync companies')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-8">Admin Tools</h1>

        <div className="bg-gray-50 rounded-lg border-2 border-gray-300 p-6 mb-6">
          <h2 className="text-xl font-bold text-black mb-4">Sync Companies</h2>
          <p className="text-black font-medium mb-4">
            This will fetch company data from Whop API and fix any placeholder companies
            that were created with experience IDs instead of company IDs.
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-3 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Syncing...' : 'Sync Companies'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">Error</h3>
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-green-900 mb-2">Success!</h3>
            <p className="text-green-800 font-medium mb-4">{result.message}</p>

            {result.results && result.results.length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-bold text-black mb-2">Results:</h4>
                <div className="space-y-2">
                  {result.results.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-300 rounded p-3 text-black font-medium"
                    >
                      <div className="font-bold">Experience: {r.experienceId}</div>
                      <div>Status: {r.status}</div>
                      {r.name && <div>Name: {r.name}</div>}
                      {r.oldId && <div>Old ID: {r.oldId}</div>}
                      {r.newId && <div>New ID: {r.newId}</div>}
                      {r.reason && <div>Reason: {r.reason}</div>}
                      {r.error && <div className="text-red-600">Error: {r.error}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
