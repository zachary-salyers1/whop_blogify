import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const brandingSettingsSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  postingPermission: z.enum(['all_members', 'admins_only']).optional()
})

/**
 * GET /api/admin/settings/:companyId
 * Get community branding settings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { companyId } = await params

    // Verify admin access to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: auth.user.id,
        companyId: companyId,
        hasAccess: true,
        role: {
          in: ['admin', 'owner']
        }
      }
    })

    if (!userCompany) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get company settings
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        settings: true
      }
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    const settings = company.settings as Record<string, any>

    return NextResponse.json({
      data: {
        companyId: company.id,
        companyName: company.name,
        appName: settings.app_name || 'Community Blog',
        primaryColor: settings.primary_color || '#3B82F6',
        logoUrl: settings.logo_url || null,
        postingPermission: settings.posting_permission || 'all_members'
      }
    })
  } catch (error) {
    console.error('Error fetching admin settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/settings/:companyId
 * Update community branding settings
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { companyId } = await params
    const body = await request.json()

    // Verify admin access to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: auth.user.id,
        companyId: companyId,
        hasAccess: true,
        role: {
          in: ['admin', 'owner']
        }
      }
    })

    if (!userCompany) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Validate input
    const validated = brandingSettingsSchema.parse(body)

    // Get current settings
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true }
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    const currentSettings = company.settings as Record<string, any>

    // Update settings
    const updatedSettings = {
      ...currentSettings,
      ...(validated.appName !== undefined && { app_name: validated.appName }),
      ...(validated.primaryColor !== undefined && { primary_color: validated.primaryColor }),
      ...(validated.logoUrl !== undefined && { logo_url: validated.logoUrl }),
      ...(validated.postingPermission !== undefined && { posting_permission: validated.postingPermission })
    }

    // Save to database
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        settings: updatedSettings
      },
      select: {
        id: true,
        name: true,
        settings: true
      }
    })

    const settings = updatedCompany.settings as Record<string, any>

    return NextResponse.json({
      data: {
        companyId: updatedCompany.id,
        companyName: updatedCompany.name,
        appName: settings.app_name || 'Community Blog',
        primaryColor: settings.primary_color || '#3B82F6',
        logoUrl: settings.logo_url || null,
        postingPermission: settings.posting_permission || 'all_members'
      }
    })
  } catch (error) {
    console.error('Error updating admin settings:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
