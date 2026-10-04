import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../middleware/errorHandler';
import { sendEmailVerificationEmail } from '../services/mail';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  company: z.object({
    siren: z.string().regex(/^\d{9}$/, 'SIREN invalide'),
    siret: z.string().nullish(),
    name: z.string().min(1),
    legalForm: z.string().nullish(),
    address: z.string().nullish(),
    vatNumber: z.string().nullish(),
  }),
  email: z.string().trim().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function signToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new ApiError(401, 'Email ou mot de passe incorrect');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Email ou mot de passe incorrect');
  }

  if (!user.emailVerified) {
    throw new ApiError(403, 'Confirmez votre adresse email avant de vous connecter (lien envoyé par email).');
  }

  res.json(sessionResponse(user));
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    throw new ApiError(404, 'Utilisateur introuvable');
  }
  res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role });
}

function sessionResponse(user: { id: string; email: string; firstName: string; lastName: string; role: string }) {
  return {
    token: signToken(user.id, user.role),
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  };
}

function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
}

// Génère un nouveau jeton de confirmation, le stocke haché et envoie le lien par email.
async function issueEmailVerification(user: { id: string; email: string; firstName: string }) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;
  try {
    await sendEmailVerificationEmail(user.email, user.firstName, verifyUrl);
  } catch (err) {
    // Le compte est créé : l'utilisateur pourra redemander l'email depuis l'écran de connexion.
    console.error("Échec de l'envoi de l'email de confirmation", err);
  }
}

// Inscription, étape 1 : indique si un compte est déjà rattaché à l'entreprise choisie.
export async function companyStatus(req: Request, res: Response) {
  const siren = String(req.query.siren ?? '').trim();
  if (!/^\d{9}$/.test(siren)) {
    throw new ApiError(400, 'SIREN invalide');
  }
  const count = await prisma.user.count({ where: { company: { siren } } });
  res.json({ hasAccount: count > 0 });
}

// Inscription, étape 2 : vérification d'unicité de l'email pendant la saisie.
export async function emailAvailable(req: Request, res: Response) {
  const email = z.string().trim().email().parse(req.query.email);
  const existing = await findUserByEmail(email);
  res.json({ available: !existing });
}

// Crée la société (ou reprend une société sans compte) et son premier administrateur,
// inactif tant que l'email n'est pas confirmé.
export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  if (await findUserByEmail(data.email)) {
    throw new ApiError(409, 'Un compte existe déjà avec cet email');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const { siren, ...companyData } = data.company;

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { siren },
      create: { siren, ...companyData },
      update: {},
      include: { _count: { select: { users: true } } },
    });
    if (company._count.users > 0) {
      throw new ApiError(409, 'Un compte existe déjà pour cette entreprise');
    }

    return tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'ADMIN',
        companyId: company.id,
      },
    });
  });

  await issueEmailVerification(user);
  res.status(201).json({ email: user.email });
}

// Valide le lien reçu par email puis ouvre directement la session.
export async function verifyEmail(req: Request, res: Response) {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findUnique({ where: { emailVerificationTokenHash: tokenHash } });
  if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
    throw new ApiError(400, 'Lien de confirmation invalide ou expiré');
  }

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
  });

  res.json(sessionResponse(verified));
}

// Renvoie un lien de confirmation. Répond toujours 204 pour ne pas révéler quels emails existent.
export async function resendVerification(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
  const user = await findUserByEmail(email);
  if (user && !user.emailVerified) {
    await issueEmailVerification(user);
  }
  res.status(204).end();
}
