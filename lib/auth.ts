import { headers } from 'next/headers'
import { prisma } from './prisma'

export interface AuthUser {
  id: string
  username?: string
  name?: string
  email?: string
  profilePicUrl?: string
}

export interface AuthContext {
  user: AuthUser
  companyId: string
  experienceId: string
  hasAccess: boolean
  isAdmin: boolean
}

/**
 * Get authenticated user from Whop headers
 * Called from server components and API routes
 */
export async function getAuthUser(): Promise<AuthContext | null> {
  const headersList = await headers()

  let userId = headersList.get('x-whop-user-id')
  let companyId = headersList.get('x-whop-company-id')
  let experienceId = headersList.get('x-whop-experience-id')

  // Development fallback - use environment variables
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID || 'dev_user_1'
    companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'dev_company_1'
    experienceId = companyId
  }

  if (!userId || !companyId || !experienceId) {
    return null
  }

  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    // Create user if doesn't exist (will be populated by webhook or API call later)
    user = await prisma.user.create({
      data: {
        id: userId,
        username: 'user_' + userId.slice(-6),
        name: 'Test User',
        email: `user_${userId.slice(-6)}@example.com`
      }
    })
  }

  // Ensure company exists
  let company = await prisma.company.findUnique({
    where: { id: companyId }
  })

  if (!company) {
    company = await prisma.company.create({
      data: {
        id: companyId,
        name: 'Development Company',
        experienceId,
        isActive: true
      }
    })
  }

  // Check if user has access to this company
  let userCompany = await prisma.userCompany.findUnique({
    where: {
      unique_user_company: {
        userId,
        companyId
      }
    }
  })

  // In development, auto-grant access
  if (!userCompany && process.env.NODE_ENV === 'development') {
    userCompany = await prisma.userCompany.create({
      data: {
        userId,
        companyId,
        hasAccess: true,
        role: 'admin'
      }
    })
  }

  const hasAccess = userCompany?.hasAccess ?? false
  const isAdmin = userCompany?.role === 'admin' || userCompany?.role === 'owner'

  return {
    user: {
      id: user.id,
      username: user.username ?? undefined,
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      profilePicUrl: user.profilePicUrl64 ?? user.profilePicUrl ?? undefined
    },
    companyId,
    experienceId,
    hasAccess,
    isAdmin
  }
}

/**
 * Require authentication or throw error
 */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthUser()

  if (!auth) {
    throw new Error('Unauthorized')
  }

  return auth
}

/**
 * Require access to company or throw error
 */
export async function requireAccess(): Promise<AuthContext> {
  const auth = await requireAuth()

  if (!auth.hasAccess) {
    throw new Error('Forbidden: No access to this company')
  }

  return auth
}

/**
 * Require admin access or throw error
 */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAccess()

  if (!auth.isAdmin) {
    throw new Error('Forbidden: Admin access required')
  }

  return auth
}
