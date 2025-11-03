/**
 * Script to sync company names from Whop API
 * Run with: npx ts-node scripts/sync-companies.ts
 */

import { prisma } from '../lib/prisma'

async function syncCompanies() {
  const WHOP_API_KEY = process.env.WHOP_API_KEY

  if (!WHOP_API_KEY) {
    console.error('WHOP_API_KEY environment variable is required')
    process.exit(1)
  }

  // Get all companies with experienceId that starts with exp_
  const companies = await prisma.company.findMany({
    where: {
      experienceId: {
        startsWith: 'exp_'
      }
    }
  })

  console.log(`Found ${companies.length} companies to sync`)

  for (const company of companies) {
    console.log(`\nSyncing company: ${company.id} (experience: ${company.experienceId})`)

    try {
      // Try to fetch experience details from Whop API
      // Note: This endpoint may not exist - we're trying to find the right one
      const response = await fetch(`https://api.whop.com/api/v1/experiences/${company.experienceId}`, {
        headers: {
          'Authorization': `Bearer ${WHOP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Experience data:', JSON.stringify(data, null, 2))

        // Update company name if we got it
        if (data.name || data.title) {
          await prisma.company.update({
            where: { id: company.id },
            data: { name: data.name || data.title }
          })
          console.log(`✓ Updated company name to: ${data.name || data.title}`)
        }
      } else {
        console.log(`✗ Failed to fetch experience: ${response.status}`)
      }
    } catch (error) {
      console.error(`✗ Error syncing company ${company.id}:`, error)
    }

    // Rate limit - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('\n✓ Sync complete')
}

syncCompanies()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
