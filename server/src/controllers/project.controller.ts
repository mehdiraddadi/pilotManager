import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['PROSPECT', 'EN_COURS', 'EN_PAUSE', 'TERMINE', 'ANNULE']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  dailyRate: z.coerce.number().optional(),
  clientId: z.string().min(1),
  managerId: z.string().min(1).optional(),
  intermediaryId: z.string().min(1).optional().nullable(),
});

export async function listProjects(_req: Request, res: Response) {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      intermediary: { select: { id: true, name: true } },
      contacts: { orderBy: { createdAt: 'asc' } },
      _count: { select: { assignments: true, contacts: true } },
    },
  });
  res.json(projects);
}

export async function getProject(req: Request, res: Response) {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      manager: true,
      intermediary: true,
      assignments: { include: { user: true } },
    },
  });
  if (!project) {
    throw new ApiError(404, 'Projet introuvable');
  }
  res.json(project);
}

export async function createProject(req: Request, res: Response) {
  const data = projectSchema.parse(req.body);
  const project = await prisma.project.create({
    data,
    include: {
      client: { select: { id: true, name: true } },
      intermediary: { select: { id: true, name: true } },
    },
  });
  res.status(201).json(project);
}

export async function updateProject(req: Request, res: Response) {
  const data = projectSchema.partial().parse(req.body);
  const project = await prisma.project.update({ where: { id: req.params.id }, data });
  res.json(project);
}

export async function deleteProject(req: Request, res: Response) {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
