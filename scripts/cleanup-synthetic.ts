import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Delete the synthetic verification event and its cost samples. These
  // were used to smoke-test /api/ingest/cost end-to-end during Phase 2
  // deploy verification. Keeping them would pollute the dashboard.
  const event = await prisma.event.findFirst({
    where: { title: 'Synthetic ingest test (phase 2 verification)' },
  })
  if (!event) {
    console.log('No synthetic event found — already cleaned up.')
    return
  }
  // The cost samples were inserted in the same batch with the same sampledAt.
  // Remove them by matching metadata or the known timestamp.
  const deletedCost = await prisma.costSample.deleteMany({
    where: {
      source: 'github_actions',
      sampledAt: new Date('2026-04-18T22:50:00Z'),
    },
  })
  const deletedEvent = await prisma.event.delete({ where: { id: event.id } })
  console.log(`Deleted ${deletedCost.count} cost samples + event ${deletedEvent.id}`)
}

main().finally(() => prisma.$disconnect())
