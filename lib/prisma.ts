import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use singleton pattern to prevent connection exhaustion
// Add ?connection_limit=10 to DATABASE_URL if issues persist
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Cache the client globally (in both dev and production)
globalForPrisma.prisma = prisma;

export default prisma;
