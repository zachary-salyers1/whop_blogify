import { headers } from 'next/headers'
import { prisma } from './prisma'
import { whopSdk } from './whop-sdk'

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
 * Fetch user data from Whop API and update local database
 */
async function fetchAndUpdateWhopUser(userId: string) {
  try {
    // Fetch user data from Whop
    const whopUser = await whopSdk.getUser({ id: userId })

    console.log('[AUTH] Fetched Whop user data:', {
      id: whopUser.id,
      username: whopUser.username,
      name: whopUser.name,
      email: whopUser.email,
      hasProfilePic: !!whopUser.profilePictureUrl
    })

    // Update or create user with real Whop data
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        username: whopUser.username || undefined,
        name: whopUser.name || undefined,
        email: whopUser.email || undefined,
        profilePicUrl: whopUser.profilePictureUrl || undefined,
        profilePicUrl32: whopUser.profilePictureUrl || undefined,
        profilePicUrl64: whopUser.profilePictureUrl || undefined,
        profilePicUrl128: whopUser.profilePictureUrl || undefined,
        updatedAt: new Date()
      },
      create: {
        id: userId,
        username: whopUser.username || `user_${userId.slice(-6)}`,
        name: whopUser.name || 'Whop User',
        email: whopUser.email || undefined,
        profilePicUrl: whopUser.profilePictureUrl || undefined,
        profilePicUrl32: whopUser.profilePictureUrl || undefined,
        profilePicUrl64: whopUser.profilePictureUrl || undefined,
        profilePicUrl128: whopUser.profilePictureUrl || undefined
      }
    })

    console.log('[AUTH] User upserted successfully:', {
      id: user.id,
      username: user.username,
      name: user.name
    })

    return user
  } catch (error) {
    console.error('[AUTH] Failed to fetch Whop user data:', error)

    // Fallback: check if user exists in DB, otherwise create with generic data
    let user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.log('[AUTH] Creating user with fallback data')
      user = await prisma.user.create({
        data: {
          id: userId,
          username: `user_${userId.slice(-6)}`,
          name: 'Whop User',
        }
      })
    }

    return user
  }
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

  // Check for Whop headers
  const whopUserToken = headersList.get('x-whop-user-token')
  const whopAppId = headersList.get('x-whop-app-id')
  const whopCompanyId = headersList.get('x-whop-company-id')
  const whopExperienceId = headersList.get('x-whop-experience-id')
  const referer = headersList.get('referer')

  // Check for custom header from client (SDK getTopLevelUrlData)
  const clientExperienceId = headersList.get('x-whop-experience-id')

  // Extract experience ID from referer URL if present
  // Pattern: https://whop.com/joined/{slug}/exp_{id}/app/
  let experienceFromUrl: string | null = null
  if (referer) {
    const expMatch = referer.match(/\/exp_([a-zA-Z0-9]+)\//)
    if (expMatch) {
      experienceFromUrl = `exp_${expMatch[1]}`
    }
  }

  console.log('[AUTH] Whop headers:', {
    whopUserToken: whopUserToken ? 'present' : 'missing',
    whopAppId,
    whopCompanyId,
    whopExperienceId,
    clientExperienceId,
    referer,
    experienceFromUrl
  })

  if (whopUserToken) {
    try {
      // Decode JWT (don't verify since we trust the header from Whop's proxy)
      const parts = whopUserToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        console.log('[AUTH] Decoded JWT payload:', payload)

        userId = payload.sub // subject is the user ID

        // Priority: client header (SDK) > URL > Whop headers > JWT > env fallback
        experienceId = clientExperienceId || experienceFromUrl || whopExperienceId || payload.experience_id || payload.eid || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'dev_company_1'

        // For now, use experience ID as company ID (we'll look up the actual company from the experience)
        companyId = experienceId

        const source = clientExperienceId ? 'client-header' : experienceFromUrl ? 'url' : whopExperienceId ? 'whop-header' : 'fallback'
        console.log('[AUTH] Extracted from JWT:', { userId, companyId, experienceId, source, jwtFields: Object.keys(payload) })
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

  // Get or create user in database with real Whop data
  const user = await fetchAndUpdateWhopUser(userId)

  // Ensure company exists - look up by experience ID first
  let company = await prisma.company.findFirst({
    where: { experienceId }
  })

  console.log('[AUTH] Lookup by experienceId:', { experienceId, found: !!company, companyId: company?.id, companyName: company?.name })

  if (!company) {
    // Company not found by experience ID, check by company ID
    company = await prisma.company.findUnique({
      where: { id: companyId }
    })
    console.log('[AUTH] Lookup by companyId:', { companyId, found: !!company, companyName: company?.name })
  }

  if (!company) {
    // Create company if it doesn't exist (will be updated by webhooks)
    console.log('[AUTH] Creating new company:', { id: companyId, experienceId })
    company = await prisma.company.create({
      data: {
        id: companyId,
        name: 'Development Company',
        experienceId,
        isActive: true
      }
    })
  }

  // Update companyId to match the actual company from the experience
  const originalCompanyId = companyId
  companyId = company.id
  console.log('[AUTH] Final company mapping:', { originalCompanyId, finalCompanyId: companyId, companyName: company.name })

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
