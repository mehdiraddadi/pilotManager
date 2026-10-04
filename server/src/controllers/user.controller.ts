import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';
import { sendPasswordChangedEmail } from '../services/mail';

const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['ADMIN', 'MANAGER', 'CONSULTANT']).default('CONSULTANT'),
    profile: z.string().optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'CONSULTANT']).optional(),
    profile: z.string().optional(),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
});

export async function listUsers(_req: Request, res: Response) {
    const users = await prisma.user.findMany({
        orderBy: { firstName: 'asc' },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            profile: true,
            _count: { select: { assignments: true } },
        },
    });
    res.json(users);
}

export async function createUser(req: Request, res: Response) {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new ApiError(409, 'Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const creator = await prisma.user.findUnique({ where: { id: req.auth!.userId } });

    // Compte créé par un administrateur : pas de confirmation d'email, rattaché à sa société.
    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            profile: data.profile,
            emailVerified: true,
            companyId: creator?.companyId,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, profile: true },
    });

    res.status(201).json(user);
}

// Modifie le profil d'un utilisateur. Si un nouveau mot de passe est fourni, il est haché et
// un email de notification est envoyé à l'adresse du compte (cf. server/src/services/mail.ts).
export async function updateUser(req: Request, res: Response) {
    const data = updateUserSchema.parse(req.body);

    if (data.email) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing && existing.id !== req.params.id) {
            throw new ApiError(409, 'Un compte existe déjà avec cet email');
        }
    }

    const { password, ...profileData } = data;

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
            ...profileData,
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, profile: true },
    });

    if (password) {
        try {
            await sendPasswordChangedEmail(user.email, user.firstName);
        } catch (err) {
            // L'échec de l'envoi d'email ne doit pas faire échouer le changement de mot de passe.
            console.error("Échec de l'envoi de l'email de changement de mot de passe :", err);
        }
    }

    res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
    if (req.auth?.userId === req.params.id) {
        throw new ApiError(400, 'Impossible de supprimer votre propre compte');
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
}
