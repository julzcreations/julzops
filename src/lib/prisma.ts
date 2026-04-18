import { PrismaClient } from '@prisma/client'

// Prisma client singleton. Unused in Phase 1 (no DB yet) but scaffolded so
// Phase 2 can import and go. DATABASE_URL is a placeholder until Neon is set up.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
