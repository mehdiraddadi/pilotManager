import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from './errorHandler';

// Bloque la création de clients/projets/etc. tant que la société (l'ESN elle-même) n'a pas
// été configurée : c'est la toute première étape à faire dans l'application.
export async function requireCompanySetup(req: Request, _res: Response, next: NextFunction) {
    const company = await prisma.company.findFirst();
    if (!company) {
        throw new ApiError(400, "Configure d'abord ta société avant de créer autre chose.");
    }
    next();
}
