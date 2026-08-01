import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const clientSchema = z.object({
  name: z.string().min(1),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
});

export async function listClients(_req: Request, res: Response) {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: {
      contacts: { orderBy: { createdAt: 'asc' } },
      _count: { select: { projects: true, contacts: true } },
    },
  });
  res.json(clients);
}

export async function getClient(req: Request, res: Response) {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { contacts: true, projects: true },
  });
  if (!client) {
    throw new ApiError(404, 'Client introuvable');
  }
  res.json(client);
}

export async function createClient(req: Request, res: Response) {
  const data = clientSchema.parse(req.body);
  const client = await prisma.client.create({ data });
  res.status(201).json(client);
}

export async function updateClient(req: Request, res: Response) {
  const data = clientSchema.partial().parse(req.body);
  const client = await prisma.client.update({ where: { id: req.params.id }, data });
  res.json(client);
}

export async function deleteClient(req: Request, res: Response) {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
