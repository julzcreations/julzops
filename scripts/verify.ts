import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const events = await prisma.event.findMany({
    take: 5,
    orderBy: { startedAt: 'desc' },
    include: { project: true },
  })
  const today = new Date(Date.UTC(2026, 3, 18))
  const cost = await prisma.costSample.aggregate({
    _sum: { costUsd: true },
    where: { sampledAt: { gte: today } },
  })
  console.log('Today spend USD:', cost._sum.costUsd ? Number(cost._sum.costUsd) : 0)
  console.log('Recent events:')
  for (const e of events) {
    console.log(`  - ${e.project.slug} | ${e.status} | ${e.title}`)
  }
}

main()
  .finally(() => prisma.$disconnect())
