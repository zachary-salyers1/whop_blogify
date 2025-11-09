import { prisma } from './prisma'

/**
 * Check if user has exceeded rate limit for post creation
 * PRD: Max 50 posts per day per user
 */
export async function checkPostRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Count posts created by user in last 24 hours
  const postCount = await prisma.post.count({
    where: {
      userId,
      createdAt: {
        gte: oneDayAgo
      },
      isDeleted: false
    }
  })

  const limit = 50
  const remaining = Math.max(0, limit - postCount)
  const allowed = postCount < limit

  // Reset time is 24 hours from now
  const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  return {
    allowed,
    remaining,
    resetAt
  }
}

/**
 * Get rate limit info for user (for displaying in UI)
 */
export async function getRateLimitInfo(userId: string): Promise<{ count: number; limit: number; remaining: number; resetAt: Date }> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const postCount = await prisma.post.count({
    where: {
      userId,
      createdAt: {
        gte: oneDayAgo
      },
      isDeleted: false
    }
  })

  const limit = 50
  const remaining = Math.max(0, limit - postCount)
  const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  return {
    count: postCount,
    limit,
    remaining,
    resetAt
  }
}
