import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';
import { sendInvoiceToClientEmail, sendInvoiceToConsultantEmail } from '../services/mail';

const generateSchema = z.object({
    clientId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format attendu : YYYY-MM'),
    // Optionnel : remplace ponctuellement le taux de TVA par défaut du client pour cette facture.
    vatRate: z.coerce.number().min(0).max(100).optional(),
});

const statusSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'PAID']),
});

export async function listInvoices(_req: Request, res: Response) {
    const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            client: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
        },
    });
    res.json(invoices);
}

export async function getInvoice(req: Request, res: Response) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: {
            client: true,
            lines: {
                include: {
                    assignment: {
                        include: {
                            user: { select: { id: true, firstName: true, lastName: true } },
                            project: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!invoice) {
        throw new ApiError(404, 'Facture introuvable');
    }
    res.json(invoice);
}

function formatDateFr(d: Date) {
    return d.toLocaleDateString('fr-FR');
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Les adresses sont stockées en une seule ligne libre. Pour l'affichage sur les factures, on
// isole le code postal (5 chiffres) et tout ce qui suit (ville, pays) sur une nouvelle ligne.
function splitAddressLines(address: string | null): string[] {
    if (!address) return [];
    const normalized = address.replace(/\s+/g, ' ').trim();
    const match = normalized.match(/\b\d{5}\b/);
    if (!match || match.index === undefined) return [normalized];
    const street = normalized.slice(0, match.index).trim();
    const cityLine = normalized.slice(match.index).trim();
    return street ? [street, cityLine] : [cityLine];
}

// L'espace insécable fine (U+202F) utilisée par toLocaleString('fr-FR') comme séparateur de
// milliers n'existe pas dans l'encodage WinAnsi des polices de base de pdfkit (Helvetica) : elle
// s'affiche comme un caractère erroné. On la remplace par un espace normal pour le PDF.
function frNumber(n: number) {
    return n
        .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .replace(/[  ]/g, ' ');
}

function formatEurosNum(n: number) {
    return `${frNumber(n)} €`;
}

function formatQtyDays(n: number) {
    return `${frNumber(n)} jour(s)`;
}

type InvoicePdfLine = {
    quantity: unknown;
    unitPrice: unknown;
    amount: unknown;
    assignment: { user: { firstName: string; lastName: string }; project: { name: string } };
};

type InvoicePdfData = {
    number: string;
    createdAt: Date;
    periodMonth: Date;
    totalAmount: unknown;
    vatRate: unknown;
    vatAmount: unknown;
    totalWithVat: unknown;
    client: {
        name: string;
        address: string | null;
        siret: string | null;
        vatNumber: string | null;
        email: string | null;
    };
    lines: InvoicePdfLine[];
};

type InvoicePdfCompany = {
    name: string;
    legalForm: string | null;
    siren: string | null;
    siret: string | null;
    vatNumber: string | null;
    address: string | null;
    email: string | null;
    iban: string | null;
    bic: string | null;
};

// Dessine le PDF de la facture (mise en forme "moderne" façon export bancaire : titre + méta en
// haut à gauche, blocs émetteur/destinataire sans encart, tableau à en-tête sombre avec colonne
// TVA par ligne, récap HT/TVA/TTC, bandeau "Détails du paiement" en pied de page). Partagé entre
// l'export réel (facture persistée) et la preview de dev (facture calculée à la volée, non
// enregistrée).
function renderInvoicePdf(
    res: Response,
    invoice: InvoicePdfData,
    company: InvoicePdfCompany,
    disposition: 'inline' | 'attachment'
) {
    const invoiceDate = invoice.createdAt;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const periodLabelStr = capitalize(periodLabel(invoice.periodMonth));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="Facture-${invoice.number}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const pageLeft = 50;
    const pageRight = 545;
    const pageWidth = pageRight - pageLeft;

    // Titre + méta (numéro / dates) en haut à gauche.
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#0f172a').text('Facture', pageLeft, 50);

    const metaLabelW = 140;
    let metaY = doc.y + 20;
    const metaRows: [string, string][] = [
        ['Numéro de facture', invoice.number],
        ["Date d'émission", formatDateFr(invoiceDate)],
        ["Date d'échéance", formatDateFr(dueDate)],
    ];
    for (const [label, value] of metaRows) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text(label, pageLeft, metaY, { width: metaLabelW });
        doc.font('Helvetica').fillColor('#0f172a').text(value, pageLeft + metaLabelW, metaY, { width: pageWidth - metaLabelW });
        metaY += 16;
    }

    // Blocs émetteur / destinataire, sur deux colonnes, sans encart.
    const blockY = metaY + 24;
    const colGap = 30;
    const colWidth = (pageWidth - colGap) / 2;
    const leftX = pageLeft;
    const rightX = pageLeft + colWidth + colGap;

    const emitterLines = [
        ...splitAddressLines(company.address),
        company.email,
        company.siret,
        company.vatNumber ? `Numéro de TVA: ${company.vatNumber}` : null,
    ].filter((l): l is string => Boolean(l));
    const destLines = [
        ...splitAddressLines(invoice.client.address),
        invoice.client.email,
        invoice.client.siret,
        invoice.client.vatNumber ? `Numéro de TVA: ${invoice.client.vatNumber}` : null,
    ].filter((l): l is string => Boolean(l));

    const entityLineGap = 3;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(company.name, leftX, blockY, { width: colWidth });
    let leftY = doc.y + 4 + entityLineGap;
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    for (const line of emitterLines) {
        doc.text(line, leftX, leftY, { width: colWidth });
        leftY = doc.y + entityLineGap;
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(invoice.client.name, rightX, blockY, { width: colWidth });
    let rightY = doc.y + 4 + entityLineGap;
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    for (const line of destLines) {
        doc.text(line, rightX, rightY, { width: colWidth });
        rightY = doc.y + entityLineGap;
    }

    // Tableau des lignes de facturation (en-tête sombre, colonne TVA par ligne).
    const colX = { description: pageLeft, qty: pageLeft + 220, unitPrice: pageLeft + 295, vat: pageLeft + 360, total: pageLeft + 425 };
    const colW = { description: 220, qty: 75, unitPrice: 65, vat: 65, total: 70 };
    const headerHeight = 22;
    let y = Math.max(leftY, rightY) + 30;

    doc.rect(pageLeft, y, pageWidth, headerHeight).fill('#111111');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    const headerTextY = y + 7;
    doc.text('Description', colX.description + 8, headerTextY, { width: colW.description - 8 });
    doc.text('Qté', colX.qty, headerTextY, { width: colW.qty - 8, align: 'right' });
    doc.text('Prix unitaire', colX.unitPrice, headerTextY, { width: colW.unitPrice - 8, align: 'right' });
    doc.text('TVA (%)', colX.vat, headerTextY, { width: colW.vat - 8, align: 'right' });
    doc.text('Total HT', colX.total, headerTextY, { width: colW.total - 8, align: 'right' });
    y += headerHeight + 10;

    for (const line of invoice.lines) {
        const description = invoice.client.name;

        doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
        const descHeight = doc.heightOfString(description, { width: colW.description - 8 });
        doc.text(description, colX.description + 8, y, { width: colW.description - 8 });
        doc.text(1, colX.qty, y, { width: colW.qty - 8, align: 'right' });
        doc.text(formatEurosNum(Number(line.amount)), colX.unitPrice, y, { width: colW.unitPrice - 8, align: 'right' });
        doc.text(`${Number(invoice.vatRate)} %`, colX.vat, y, { width: colW.vat - 8, align: 'right' });
        doc.font('Helvetica-Bold').text(formatEurosNum(Number(line.amount)), colX.total, y, { width: colW.total - 8, align: 'right' });

        y += descHeight + 14;
        doc.moveTo(pageLeft, y - 6).lineTo(pageRight, y - 6).strokeColor('#e2e8f0').stroke();
    }

    // Récapitulatif HT / TVA / TTC, aligné à droite sous les colonnes PU/TVA/Total.
    y += 10;
    const summaryX = colX.unitPrice;
    const summaryLabelW = colX.total - colX.unitPrice;
    const summaryValueW = pageRight - colX.total;

    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    doc.text('Total HT', summaryX, y, { width: summaryLabelW });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatEurosNum(Number(invoice.totalAmount)), colX.total, y, {
        width: summaryValueW,
        align: 'right',
    });
    y += 16;

    doc.font('Helvetica').fillColor('#334155').text('Montant total de la TVA', summaryX, y, {
        width: summaryLabelW,
    });
    doc.fillColor('#0f172a').text(formatEurosNum(Number(invoice.vatAmount)), colX.total, y, {
        width: summaryValueW,
        align: 'right',
    });
    y += 16;

    doc.moveTo(summaryX, y).lineTo(pageRight, y).strokeColor('#94a3b8').stroke();
    y += 6;

    doc.rect(summaryX, y, pageRight - summaryX, 20).fill('#f1f1f1');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    doc.text('Total TTC', summaryX + 6, y + 6, { width: summaryLabelW - 6 });
    doc.text(formatEurosNum(Number(invoice.totalWithVat)), colX.total, y + 6, {
        width: summaryValueW - 6,
        align: 'right',
    });
    y += 30;

    // Mentions légales.
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    const legalLines = [
        "Pas d'escompte accordé pour paiement anticipé.",
        "En cas de non-paiement à la date d'échéance, des pénalités calculées à trois fois le taux d'intérêt légal seront appliquées.",
        'Tout retard de paiement entraînera une indemnité forfaitaire pour frais de recouvrement de 40€.',
    ];
    for (const line of legalLines) {
        doc.text(line, pageLeft, y, { width: pageWidth });
        y = doc.y;
    }

    // Bandeau "Détails du paiement" épinglé en bas de page (sur une nouvelle page si le contenu
    // au-dessus déborde jusque là).
    const footerHeight = 130;
    let footerY = doc.page.height - 50 - footerHeight;
    if (y + 20 > footerY) {
        doc.addPage();
        footerY = doc.page.height - 50 - footerHeight;
    }

    doc.rect(0, footerY, doc.page.width, doc.page.height - footerY).fill('#f8fafc');

    let fy = footerY + 20;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Détails du paiement', pageLeft, fy, { width: pageWidth });
    fy = doc.y + 8;

    const paymentRows: [string, string][] = [['Nom du bénéficiaire', company.name]];
    if (company.bic) paymentRows.push(['BIC', company.bic]);
    if (company.iban) paymentRows.push(['IBAN', company.iban]);

    doc.fontSize(9);
    for (const [label, value] of paymentRows) {
        doc.font('Helvetica-Bold').fillColor('#334155').text(label, pageLeft, fy, { width: metaLabelW });
        doc.font('Helvetica').fillColor('#0f172a').text(value, pageLeft + metaLabelW, fy, { width: pageWidth - metaLabelW });
        fy += 14;
    }

    fy += 6;
    doc.moveTo(pageLeft, fy).lineTo(pageRight, fy).strokeColor('#cbd5e1').stroke();
    fy += 12;

    const footerLine = company.legalForm ? `${company.name}, ${company.legalForm}` : company.name;
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
    doc.text(footerLine, pageLeft, fy, { width: pageWidth / 2 });
    doc.text(`${invoice.number} · 1/1`, pageLeft, fy, { width: pageWidth, align: 'right' });

    doc.end();
}

// Génère le PDF d'une facture existante (mise en forme "classique" : émetteur/destinataire,
// tableau de lignes, récap HT/TVA/TTC, informations de paiement) — téléchargeable avant envoi au client.
export async function exportInvoicePdf(req: Request, res: Response) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: {
            client: { include: { contacts: { orderBy: { createdAt: 'asc' } } } },
            lines: {
                include: {
                    assignment: {
                        include: {
                            user: { select: { firstName: true, lastName: true } },
                            project: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!invoice) throw new ApiError(404, 'Facture introuvable');

    const company = await prisma.company.findFirst({
        include: { contacts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!company) {
        throw new ApiError(400, "Configure d'abord ta société avant de générer une facture PDF");
    }

    renderInvoicePdf(
        res,
        { ...invoice, client: { ...invoice.client, email: invoice.client.contacts[0]?.email ?? null } },
        { ...company, email: company.contacts[0]?.email ?? null },
        'inline'
    );
}

const previewQuerySchema = z.object({
    clientId: z.string().min(1).optional(),
    month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
});

// Route de dev sans authentification (voir invoice.routes.ts) : ouvrir l'URL directement dans le
// navigateur affiche le PDF inline, sans créer de facture en base. Pratique pour itérer sur la
// mise en page de la facture. clientId/month par défaut = le premier client trouvé / le mois en
// cours, pour pouvoir ouvrir la route sans aucun paramètre.
export async function previewInvoice(req: Request, res: Response) {
    const { clientId: queryClientId, month: queryMonth } = previewQuerySchema.parse(req.query);

    const clientId = queryClientId ?? (await prisma.client.findFirst())?.id;
    if (!clientId) {
        throw new ApiError(400, "Aucun client en base : impossible de choisir un client par défaut, passe ?clientId=...");
    }
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { contacts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!client) throw new ApiError(404, 'Client introuvable');

    const now = new Date();
    const month = queryMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNum - 1, 1));
    const end = new Date(Date.UTC(year, monthNum, 1));

    const projects = await prisma.project.findMany({
        where: { clientId },
        include: {
            assignments: {
                include: {
                    user: { select: { firstName: true, lastName: true } },
                    timeEntries: { where: { date: { gte: start, lt: end }, type: 'WORKED' } },
                },
            },
        },
    });

    const lines: InvoicePdfLine[] = [];
    for (const project of projects) {
        for (const assignment of project.assignments) {
            const quantity = assignment.timeEntries.reduce(
                (sum: number, e: { quantity: unknown }) => sum + Number(e.quantity),
                0
            );
            if (quantity <= 0) continue;

            const unitPrice = Number(assignment.rate ?? project.dailyRate ?? 0);
            const amount = quantity * unitPrice;

            lines.push({
                quantity,
                unitPrice,
                amount,
                assignment: {
                    user: { firstName: assignment.user.firstName, lastName: assignment.user.lastName },
                    project: { name: project.name },
                },
            });
        }
    }

    if (lines.length === 0) {
        throw new ApiError(400, 'Aucune journée déclarée pour ce client sur cette période');
    }

    const totalAmount = lines.reduce((sum, l) => sum + Number(l.amount), 0);
    const vatRate = Number(client.vatRate);
    const vatAmount = totalAmount * (vatRate / 100);
    const totalWithVat = totalAmount + vatAmount;

    const company = await prisma.company.findFirst({
        include: { contacts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!company) {
        throw new ApiError(400, "Configure d'abord ta société avant de générer une facture PDF");
    }

    renderInvoicePdf(
        res,
        {
            number: `APERCU-${month}`,
            createdAt: now,
            periodMonth: start,
            totalAmount,
            vatRate,
            vatAmount,
            totalWithVat,
            client: { ...client, email: client.contacts[0]?.email ?? null },
            lines,
        },
        { ...company, email: company.contacts[0]?.email ?? null },
        'inline'
    );
}

// Agrège les jours de CRA déclarés par affectation, pour un client et un mois donnés,
// et crée une facture (une ligne par consultant staffé sur un projet de ce client).
export async function generateInvoice(req: Request, res: Response) {
    const { clientId, month, vatRate: vatRateOverride } = generateSchema.parse(req.body);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
        throw new ApiError(404, 'Client introuvable');
    }

    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNum - 1, 1));
    const end = new Date(Date.UTC(year, monthNum, 1));

    const projects = await prisma.project.findMany({
        where: { clientId },
        include: {
            assignments: {
                include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                    // Seuls les jours de production (travaillés) sont facturables : les absences
                    // (RTT, congés, maladie...) et l'activité interne ne doivent pas être facturées.
                    timeEntries: { where: { date: { gte: start, lt: end }, type: 'WORKED' } },
                },
            },
        },
    });

    const lineInputs: {
        assignmentId: string;
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
    }[] = [];

    for (const project of projects) {
        for (const assignment of project.assignments) {
            const quantity = assignment.timeEntries.reduce(
                (sum: number, e: { quantity: unknown }) => sum + Number(e.quantity),
                0
            );
            if (quantity <= 0) continue;

            // Le taux négocié pour l'affectation prime sur le TJM par défaut du projet.
            const unitPrice = Number(assignment.rate ?? project.dailyRate ?? 0);
            const amount = quantity * unitPrice;

            lineInputs.push({
                assignmentId: assignment.id,
                description: `${assignment.user.firstName} ${assignment.user.lastName} — ${project.name}`,
                quantity,
                unitPrice,
                amount,
            });
        }
    }

    if (lineInputs.length === 0) {
        throw new ApiError(400, 'Aucune journée déclarée pour ce client sur cette période');
    }

    const totalAmount = lineInputs.reduce((sum, l) => sum + l.amount, 0);
    // Le taux du client est figé sur la facture au moment de la génération : un changement
    // ultérieur du taux par défaut du client n'affecte pas les factures déjà émises.
    const vatRate = vatRateOverride ?? Number(client.vatRate);
    const vatAmount = totalAmount * (vatRate / 100);
    const totalWithVat = totalAmount + vatAmount;
    const count = await prisma.invoice.count();
    const number = `F-${year}-${String(monthNum).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
        data: {
            number,
            clientId,
            periodMonth: start,
            totalAmount,
            vatRate,
            vatAmount,
            totalWithVat,
            lines: { create: lineInputs },
        },
        include: {
            lines: true,
            client: { select: { id: true, name: true } },
        },
    });

    res.status(201).json(invoice);
}

function formatEuros(amount: unknown) {
    return `${Number(amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
}

function periodLabel(periodMonth: Date) {
    return periodMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// Envoie la facture par email au premier contact du client (celui-ci doit avoir un email renseigné).
export async function sendInvoiceToClient(req: Request, res: Response) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { client: { include: { contacts: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!invoice) throw new ApiError(404, 'Facture introuvable');

    const recipientEmail = invoice.client.contacts[0]?.email;
    if (!recipientEmail) {
        throw new ApiError(400, "Ce client n'a aucun contact avec une adresse email renseignée");
    }

    await sendInvoiceToClientEmail(recipientEmail, invoice.client.name, {
        number: invoice.number,
        periodLabel: periodLabel(invoice.periodMonth),
        totalAmount: `${formatEuros(invoice.totalWithVat)} TTC`,
    });

    res.json({ sentTo: recipientEmail });
}

// Envoie une notification par email à chaque consultant facturé sur cette facture.
export async function sendInvoiceToConsultant(req: Request, res: Response) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: {
            lines: { include: { assignment: { include: { user: true } } } },
        },
    });
    if (!invoice) throw new ApiError(404, 'Facture introuvable');

    const consultants = new Map(invoice.lines.map((line) => [line.assignment.user.id, line.assignment.user]));
    if (consultants.size === 0) {
        throw new ApiError(400, 'Aucun consultant associé à cette facture');
    }

    const info = {
        number: invoice.number,
        periodLabel: periodLabel(invoice.periodMonth),
        totalAmount: `${formatEuros(invoice.totalWithVat)} TTC`,
    };
    await Promise.all(
        [...consultants.values()].map((consultant) =>
            sendInvoiceToConsultantEmail(consultant.email, consultant.firstName, info)
        )
    );

    res.json({ sentTo: [...consultants.values()].map((c) => c.email) });
}

export async function updateInvoiceStatus(req: Request, res: Response) {
    const data = statusSchema.parse(req.body);
    const invoice = await prisma.invoice.update({
        where: { id: req.params.id },
        data: { status: data.status },
    });
    res.json(invoice);
}

export async function deleteInvoice(req: Request, res: Response) {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) {
        throw new ApiError(404, 'Facture introuvable');
    }
    if (invoice.status !== 'DRAFT') {
        throw new ApiError(409, 'Seules les factures en brouillon peuvent être supprimées');
    }
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.status(204).send();
}
