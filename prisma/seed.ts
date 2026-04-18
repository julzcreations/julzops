import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed the projects JulzOps watches. Idempotent — upsert by slug.
  const projects = [
    {
      slug: 'swirl-series-automation',
      name: 'Swirl Series',
      description: 'Daily IG↔Notion reel reconciliation + next-script generation for Swirlie',
      repoUrl: 'https://github.com/jw-yue/swirl-series-automation',
      color: '#ff8fab', // pink-400
    },
    {
      slug: 'julzops',
      name: 'JulzOps',
      description: 'This dashboard. Self-instrumented from day 1.',
      repoUrl: 'https://github.com/jw-yue/julzops',
      color: '#a78bfa', // purple-400
    },
  ]

  for (const p of projects) {
    await prisma.project.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, repoUrl: p.repoUrl, color: p.color },
      create: p,
    })
    console.log(`✓ upserted ${p.slug}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
