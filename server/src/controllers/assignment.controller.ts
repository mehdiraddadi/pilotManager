import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const assignmentSchema = z.object({
    userId: z.string().min(1),
    projectId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    rate: z.coerce.number().optional(),
});

export async function listAssignments(req: Request, res: Response) {
    const { projectId, userId } = req.query;

    const assignments = await prisma.assignment.findMany({
        where: {
            ...(projectId ? { projectId: String(projectId) } : {}),
            ...(userId ? { userId: String(userId) } : {}),
        },
        orderBy: { startDate: 'desc' },
        include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            project: {
                select: {
                    id: true,
                    name: true,
                    client: { select: { name: true } },
                    intermediary: { select: { id: true, name: true } },
                },
            },
        },
    });

    res.json(assignments);
}

export async function createAssignment(req: Request, res: Response) {
    const data = assignmentSchema.parse(req.body);

    const [user, project] = await Promise.all([
        prisma.user.findUnique({ where: { id: data.userId } }),
        prisma.project.findUnique({ where: { id: data.projectId } }),
    ]);

    if (!user) throw new ApiError(404, 'Consultant introuvable');
    if (!project) throw new ApiError(404, 'Projet introuvable');

    const assignment = await prisma.assignment.create({
        data,
        include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            project: { select: { id: true, name: true } },
        },
    });

    res.status(201).json(assignment);
}

export async function updateAssignment(req: Request, res: Response) {
    const data = assignmentSchema.partial().parse(req.body);

    if (data.userId || data.projectId) {
        const [user, project] = await Promise.all([
            data.userId ? prisma.user.findUnique({ where: { id: data.userId } }) : null,
            data.projectId ? prisma.project.findUnique({ where: { id: data.projectId } }) : null,
        ]);
        if (data.userId && !user) throw new ApiError(404, 'Consultant introuvable');
        if (data.projectId && !project) throw new ApiError(404, 'Projet introuvable');
    }

    const assignment = await prisma.assignment.update({
        where: { id: req.params.id },
        data,
        include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            project: { select: { id: true, name: true } },
        },
    });

    res.json(assignment);
}

export async function deleteAssignment(req: Request, res: Response) {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
}
