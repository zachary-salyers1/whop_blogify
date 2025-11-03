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

  let userId: string | null = null
  let companyId: string | null = null
  let experienceId: string | null = null

  // Check for Whop JWT token
  const whopUserToken = headersList.get('x-whop-user-token')
  const whopAppId = headersList.get('x-whop-app-id')

  console.log('[AUTH] Whop headers:', { whopUserToken: whopUserToken ? 'present' : 'missing', whopAppId })

  if (whopUserToken) {
    try {
      // Decode JWT (don't verify since we trust the header from Whop's proxy)
      const parts = whopUserToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        console.log('[AUTH] Decoded JWT payload:', payload)

        userId = payload.sub // subject is the user ID
        // For now, use the app ID as company/experience until we get the actual company
        companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'dev_company_1'
        experienceId = companyId

        console.log('[AUTH] Extracted from JWT:', { userId, companyId, experienceId })
      }
    } catch (error) {
      console.error('[AUTH] Failed to decode JWT:', error)
    }
  }

  // Fallback to environment variables if no JWT
  if (!userId) {
    console.log('[AUTH] No JWT found, using env fallback')
    userId = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID || 'dev_user_1'
    companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'dev_company_1'
    experienceId = companyId
    console.log('[AUTH] Using fallback values:', { userId, companyId, experienceId })
  }

  if (!userId || !companyId || !experienceId) {
    console.log('[AUTH] Missing required auth values, returning null')
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

  // Auto-grant access if user is authenticated (JWT or dev mode)
  // In production, this will be verified by webhooks, but we need initial access
  if (!userCompany) {
    userCompany = await prisma.userCompany.create({
      data: {
        userId,
        companyId,
        hasAccess: true,
        role: 'member' // Default role, webhooks will update if admin
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
