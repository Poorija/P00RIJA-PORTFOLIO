import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isDev = process.env.NODE_ENV !== 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is invaluable during development but writes every query to
    // stdout in production, adding avoidable I/O and CPU overhead under load.
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  })

if (isDev) globalForPrisma.prisma = db