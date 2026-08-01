import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const createContactSchema = z.object({
  clientId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
});

const updateContactSchema = createContactSchema.omit({ clientId: true }).partial();

export async function createContact(req: Request, res: Response) {
  const data = createContactSchema.parse(req.body);

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    throw new ApiError(404, 'Client introuvable');
  }

  const contact = await prisma.contact.create({ data });
  res.status(201).json(contact);
}

export async function updateContact(req: Request, res: Response) {
  const data = updateContactSchema.parse(req.body);
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data });
  res.json(contact);
}

export async function deleteContact(req: Request, res: Response) {
  await prisma.contact.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
