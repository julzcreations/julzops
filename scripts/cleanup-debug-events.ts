import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Remove debugging noise left from Phase 2 verification:
  //   - `source = "probe"` events I created via curl to test the webhook
  //   - `kind = "reconcile_usage"` failure events from when the Anthropic
  //     admin key was misconfigured (the route is now a stubbed no-op so
  //     it won't generate new events)
  const probes = await prisma.event.deleteMany({ where: { source: 'probe' } })
  const failedReconciles = await prisma.event.deleteMany({
    where: { kind: 'reconcile_usage' },
  })
  console.log(`Deleted ${probes.count} probe events + ${failedReconciles.count} reconcile events`)
}

main().finally(() => prisma.$disconnect())
