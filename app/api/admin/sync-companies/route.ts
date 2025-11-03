import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/sync-companies
 * Manually sync company data by fetching user memberships from Whop API
 * This will find the real company IDs for each experience
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.WHOP_API_KEY) {
      return NextResponse.json({ error: 'WHOP_API_KEY not configured' }, { status: 500 })
    }

    // Get all companies with experience IDs
    const companies = await prisma.company.findMany({
      where: {
        experienceId: {
          startsWith: 'exp_'
        }
      }
    })

    console.log(`Found ${companies.length} companies with experience IDs`)

    const results = []

    // For each company, try to find the real company ID via memberships
    for (const company of companies) {
      console.log(`\nProcessing: ${company.id} (experience: ${company.experienceId})`)

      try {
        // Get a user who has access to this company
        const userCompany = await prisma.userCompany.findFirst({
          where: {
            companyId: company.id,
            hasAccess: true
          },
          include: {
            user: true
          }
        })

        if (!userCompany) {
          console.log('No users found with access to this company')
          results.push({
            experienceId: company.experienceId,
            status: 'skipped',
            reason: 'No users with access'
          })
          continue
        }

        console.log(`Found user ${userCompany.userId} with access`)

        // Fetch all memberships for this user
        const response = await fetch(`https://api.whop.com/api/v1/memberships?user_ids=${userCompany.userId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.log(`Failed to fetch memberships: ${response.status}`)
          results.push({
            experienceId: company.experienceId,
            status: 'error',
            reason: `API error: ${response.status}`
          })
          continue
        }

        const data = await response.json()
        console.log(`Found ${data.data?.length || 0} memberships`)

        // Find membership with matching experience ID or company
        const membership = data.data?.find((m: any) =>
          m.plan?.experiences?.some((exp: any) => exp.id === company.experienceId) ||
          m.company_id === company.id
        )

        if (membership && membership.company) {
          const realCompanyId = membership.company_id
          const companyName = membership.company.title || membership.company.name

          console.log(`Found match: ${realCompanyId} - ${companyName}`)

          // Check if a company with this real ID already exists
          const existingCompany = await prisma.company.findUnique({
            where: { id: realCompanyId }
          })

          if (existingCompany && existingCompany.id !== company.id) {
            // Real company exists, migrate data to it
            console.log(`Migrating to existing company: ${realCompanyId}`)

            // Update all user_companies references
            await prisma.userCompany.updateMany({
              where: { companyId: company.id },
              data: { companyId: realCompanyId }
            })

            // Update all posts references
            await prisma.post.updateMany({
              where: { companyId: company.id },
              data: { companyId: realCompanyId }
            })

            // Delete the placeholder company
            await prisma.company.delete({
              where: { id: company.id }
            })

            results.push({
              experienceId: company.experienceId,
              oldId: company.id,
              newId: realCompanyId,
              name: companyName,
              status: 'migrated'
            })
          } else if (!existingCompany) {
            // Real company doesn't exist, update this one
            console.log(`Updating company ID: ${company.id} -> ${realCompanyId}`)

            // This is complex because we need to update the primary key
            // Easier to create new and migrate
            const newCompany = await prisma.company.create({
              data: {
                id: realCompanyId,
                name: companyName,
                experienceId: company.experienceId,
                isActive: true
              }
            })

            // Update references
            await prisma.userCompany.updateMany({
              where: { companyId: company.id },
              data: { companyId: realCompanyId }
            })

            await prisma.post.updateMany({
              where: { companyId: company.id },
              data: { companyId: realCompanyId }
            })

            // Delete old
            await prisma.company.delete({
              where: { id: company.id }
            })

            results.push({
              experienceId: company.experienceId,
              oldId: company.id,
              newId: realCompanyId,
              name: companyName,
              status: 'created'
            })
          } else {
            // IDs match, just update name
            await prisma.company.update({
              where: { id: company.id },
              data: { name: companyName }
            })

            results.push({
              experienceId: company.experienceId,
              id: company.id,
              name: companyName,
              status: 'updated'
            })
          }
        } else {
          console.log('No matching membership found')
          results.push({
            experienceId: company.experienceId,
            status: 'not_found',
            reason: 'No matching membership'
          })
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error processing ${company.id}:`, error)
        results.push({
          experienceId: company.experienceId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} companies`,
      results
    })
  } catch (error) {
    console.error('Error syncing companies:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
