import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const createProjectContactSchema = z.object({
  projectId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().optional(),
});

const updateProjectContactSchema = createProjectContactSchema.omit({ projectId: true }).partial();

export async function createProjectContact(req: Request, res: Response) {
  const data = createProjectContactSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) {
    throw new ApiError(404, 'Projet introuvable');
  }

  const contact = await prisma.projectContact.create({ data });
  res.status(201).json(contact);
}

export async function updateProjectContact(req: Request, res: Response) {
  const data = updateProjectContactSchema.parse(req.body);
  const contact = await prisma.projectContact.update({ where: { id: req.params.id }, data });
  res.json(contact);
}

export async function deleteProjectContact(req: Request, res: Response) {
  await prisma.projectContact.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
