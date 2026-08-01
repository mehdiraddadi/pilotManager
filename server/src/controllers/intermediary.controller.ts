import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const intermediarySchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  logo: z.string().optional(),
});

export async function listIntermediaries(_req: Request, res: Response) {
  const intermediaries = await prisma.intermediary.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  });
  res.json(intermediaries);
}

export async function getIntermediary(req: Request, res: Response) {
  const intermediary = await prisma.intermediary.findUnique({
    where: { id: req.params.id },
    include: { projects: true },
  });
  if (!intermediary) {
    throw new ApiError(404, 'Intermédiaire introuvable');
  }
  res.json(intermediary);
}

export async function createIntermediary(req: Request, res: Response) {
  const data = intermediarySchema.parse(req.body);
  const intermediary = await prisma.intermediary.create({ data });
  res.status(201).json(intermediary);
}

export async function updateIntermediary(req: Request, res: Response) {
  const data = intermediarySchema.partial().parse(req.body);
  const intermediary = await prisma.intermediary.update({ where: { id: req.params.id }, data });
  res.json(intermediary);
}

export async function deleteIntermediary(req: Request, res: Response) {
  await prisma.intermediary.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
