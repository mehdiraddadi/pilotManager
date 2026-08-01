import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const createCompanyContactSchema = z.object({
    companyId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().optional(),
    phone: z.string().optional(),
    mobile: z.string().optional(),
});

const updateCompanyContactSchema = createCompanyContactSchema.omit({ companyId: true }).partial();

export async function createCompanyContact(req: Request, res: Response) {
    const data = createCompanyContactSchema.parse(req.body);

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) {
        throw new ApiError(404, 'Société introuvable');
    }

    const contact = await prisma.companyContact.create({ data });
    res.status(201).json(contact);
}

export async function updateCompanyContact(req: Request, res: Response) {
    const data = updateCompanyContactSchema.parse(req.body);
    const contact = await prisma.companyContact.update({ where: { id: req.params.id }, data });
    res.json(contact);
}

export async function deleteCompanyContact(req: Request, res: Response) {
    await prisma.companyContact.delete({ where: { id: req.params.id } });
    res.status(204).send();
}
