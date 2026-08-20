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

// Codes "nature juridique" INSEE les plus courants pour les PME/ESN françaises.
const LEGAL_FORM_LABELS: Record<string, string> = {
    '1000': 'Entrepreneur individuel',
    '5202': 'Société en nom collectif',
    '5385': 'Société civile professionnelle',
    '5410': 'SARL',
    '5415': 'EURL',
    '5422': 'SA à conseil d\'administration',
    '5426': 'SA à directoire',
    '5498': 'SA',
    '5499': 'SA',
    '5505': 'SAS',
    '5510': 'SASU',
    '5610': 'SCI',
    '5720': 'Société coopérative de production (SA)',
    '9220': 'Association déclarée',
};

// Calcule la clé de TVA intracommunautaire française à partir du SIREN (norme officielle),
// utilisé en repli quand l'Annuaire des Entreprises ne renvoie pas déjà le numéro de TVA.
function vatFromSiren(siren: string): string {
    const key = (12 + 3 * (Number(siren) % 97)) % 97;
    return `FR${String(key).padStart(2, '0')}${siren}`;
}

interface RechercheEntreprisesResult {
    siren: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    nature_juridique?: string;
    tva?: string[];
    siege?: { siret?: string; adresse?: string };
}

// Recherche par nom, SIREN, SIRET ou TVA (convertie en SIREN) via l'API publique
// "Recherche d'entreprises" (recherche-entreprises.api.gouv.fr), sans clé d'authentification.
export async function searchCompanies(req: Request, res: Response) {
    const query = String(req.query.q ?? '').trim();
    if (query.length < 2) {
        return res.json([]);
    }

    // Un numéro de TVA FR encode le SIREN sur ses 9 derniers chiffres : on le décode
    // pour retomber sur une recherche directe par SIREN, seule reconnue par l'API.
    const vatMatch = query.replace(/\s/g, '').toUpperCase().match(/^FR[0-9A-Z]{2}(\d{9})$/);
    const searchTerm = vatMatch ? vatMatch[1] : query;

    const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(searchTerm)}&per_page=8`,
        { headers: { 'User-Agent': 'PilotManager (contact: support@pilotmanager.app)' } }
    );

    if (!response.ok) {
        throw new ApiError(502, "Impossible d'interroger l'Annuaire des Entreprises");
    }

    const data = (await response.json()) as { results?: RechercheEntreprisesResult[] };

    const results = (data.results ?? []).map((r) => ({
        siren: r.siren,
        siret: r.siege?.siret ?? null,
        name: r.nom_raison_sociale || r.nom_complet || '',
        legalForm: (r.nature_juridique && LEGAL_FORM_LABELS[r.nature_juridique]) ?? null,
        address: r.siege?.adresse ?? null,
        vatNumber: r.tva?.[0] ?? (r.siren ? vatFromSiren(r.siren) : null),
    }));

    res.json(results);
}

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
