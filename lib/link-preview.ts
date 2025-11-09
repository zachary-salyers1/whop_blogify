import { prisma } from './prisma'

interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  domain: string | null
  fetchSuccess: boolean
  fetchError: string | null
}

/**
 * Extract URLs from text content
 */
export function extractUrls(text: string): string[] {
  // Simple URL regex - matches http(s) URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = text.match(urlRegex) || []

  // Remove duplicates and clean URLs
  const uniqueUrls = [...new Set(matches)].map(url => {
    // Remove trailing punctuation
    return url.replace(/[.,;:!?)\]]+$/, '')
  })

  return uniqueUrls
}

/**
 * Fetch metadata for a URL using open graph tags and meta tags
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhopBlogify/1.0; +https://whop.com)'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const domain = new URL(url).hostname

    // Extract meta tags
    const title = extractMetaTag(html, [
      'og:title',
      'twitter:title',
      'title'
    ]) || domain

    const description = extractMetaTag(html, [
      'og:description',
      'twitter:description',
      'description'
    ])

    const imageUrl = extractMetaTag(html, [
      'og:image',
      'twitter:image',
      'twitter:image:src'
    ])

    return {
      url,
      title: title?.substring(0, 500) || null,
      description: description?.substring(0, 1000) || null,
      imageUrl: imageUrl?.substring(0, 2000) || null,
      domain,
      fetchSuccess: true,
      fetchError: null
    }
  } catch (error) {
    const domain = new URL(url).hostname
    return {
      url,
      title: null,
      description: null,
      imageUrl: null,
      domain,
      fetchSuccess: false,
      fetchError: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract content from meta tags in HTML
 */
function extractMetaTag(html: string, properties: string[]): string | null {
  for (const prop of properties) {
    // Try og: and twitter: meta tags
    const ogRegex = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')
    const match = html.match(ogRegex)
    if (match && match[1]) {
      return match[1]
    }

    // Try reverse order (content before property)
    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
    const reverseMatch = html.match(reverseRegex)
    if (reverseMatch && reverseMatch[1]) {
      return reverseMatch[1]
    }

    // For title tag
    if (prop === 'title') {
      const titleRegex = /<title[^>]*>([^<]+)<\/title>/i
      const titleMatch = html.match(titleRegex)
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim()
      }
    }
  }
  return null
}

/**
 * Generate link previews for a post and save to database
 */
export async function generateLinkPreviews(postId: bigint, content: string): Promise<void> {
  const urls = extractUrls(content)

  // Limit to first 3 URLs to avoid spam
  const urlsToFetch = urls.slice(0, 3)

  if (urlsToFetch.length === 0) {
    return
  }

  // Fetch previews in parallel
  const previews = await Promise.all(
    urlsToFetch.map(url => fetchLinkPreview(url))
  )

  // Save to database
  for (const preview of previews) {
    await prisma.postLink.create({
      data: {
        postId,
        url: preview.url,
        title: preview.title,
        description: preview.description,
        imageUrl: preview.imageUrl,
        domain: preview.domain,
        fetchSuccess: preview.fetchSuccess,
        fetchError: preview.fetchError
      }
    })
  }
}
