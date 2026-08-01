import { PrismaClient } from '@prisma/client';

// Singleton pour éviter d'ouvrir trop de connexions en dev (hot-reload)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
