import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// KPIs de la page d'accueil :
// - clients actifs : au moins un projet en cours
// - projets en cours : statut EN_COURS
// - consultants staffés : affectation active aujourd'hui sur un projet en cours
export async function getDashboardStats(_req: Request, res: Response) {
  const now = new Date();

  const [activeClients, ongoingProjects, staffedConsultants] = await Promise.all([
    prisma.client.count({ where: { projects: { some: { status: 'EN_COURS' } } } }),
    prisma.project.count({ where: { status: 'EN_COURS' } }),
    prisma.user.count({
      where: {
        assignments: {
          some: {
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            project: { status: 'EN_COURS' },
          },
        },
      },
    }),
  ]);

  res.json({ activeClients, ongoingProjects, staffedConsultants });
}
