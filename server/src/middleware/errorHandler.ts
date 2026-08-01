import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Données invalides', details: err.flatten() });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Suppression impossible : cet élément est utilisé par d\'autres données (projets, factures, affectations...).',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Élément introuvable' });
    }
  }

  console.error(err);
  return res.status(500).json({ error: 'Erreur interne du serveur' });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route non trouvée : ${req.method} ${req.originalUrl}` });
}
