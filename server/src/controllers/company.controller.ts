import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const companySchema = z.object({
    name: z.string().min(1),
    legalForm: z.string().optional(),
    siren: z.string().optional(),
    siret: z.string().optional(),
    vatNumber: z.string().optional(),
    address: z.string().optional(),
    iban: z.string().optional(),
    bic: z.string().optional(),
});

// Société unique (singleton applicatif) : renvoie null tant qu'elle n'a pas été configurée.
export async function getCompany(_req: Request, res: Response) {
    const company = await prisma.company.findFirst({
        include: { contacts: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(company);
}

export async function createCompany(req: Request, res: Response) {
    const existing = await prisma.company.findFirst();
    if (existing) {
        throw new ApiError(409, 'La société est déjà configurée');
    }

    const data = companySchema.parse(req.body);
    const company = await prisma.company.create({ data });
    res.status(201).json(company);
}

export async function updateCompany(req: Request, res: Response) {
    const data = companySchema.partial().parse(req.body);
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    res.json(company);
}
