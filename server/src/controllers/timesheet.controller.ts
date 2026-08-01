import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const upsertSchema = z.object({
    assignmentId: z.string().min(1),
    date: z.coerce.date(),
    type: z.enum(['WORKED', 'INTERNE', 'RTT', 'CP', 'MALADIE', 'AUTRE']).default('WORKED'),
    quantity: z.coerce.number().min(0).max(1),
    comment: z.string().optional(),
});

const summaryQuerySchema = z.object({
    userId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
});

const summaryUpdateSchema = z.object({
    userId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    comment: z.string().optional(),
    status: z.enum(['DRAFT', 'VALIDATED', 'REJECTED']).optional(),
});

const TYPE_LABELS: Record<string, string> = {
    WORKED: 'Travaillé',
    INTERNE: 'Interne',
    RTT: 'RTT',
    CP: 'Congés payés',
    MALADIE: 'Maladie',
    AUTRE: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Brouillon',
    VALIDATED: 'Validé',
    REJECTED: 'Rejeté',
};

const DOW_FULL_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function formatQty(n: number) {
    return n.toFixed(2).replace('.', ',');
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Convertit un logo stocké en data URL base64 ("data:image/png;base64,...") en Buffer
// exploitable par pdfkit. Retourne null si la valeur n'est pas exploitable.
function decodeLogo(dataUrl: string | null | undefined): Buffer | null {
    if (!dataUrl) return null;
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    try {
        return Buffer.from(match[2], 'base64');
    } catch {
        return null;
    }
}

function monthStart(month: string) {
    const [year, monthIndex] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthIndex - 1, 1));
}

function monthEnd(month: string) {
    const [year, monthIndex] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthIndex, 1));
}

interface TimeEntryFilter {
    assignmentId?: string;
    assignment?: { userId: string };
    date?: { gte: Date; lt: Date };
}

export async function listTimeEntries(req: Request, res: Response) {
    const { assignmentId, userId, month } = req.query;
    const where: TimeEntryFilter = {};

    if (assignmentId) {
        where.assignmentId = String(assignmentId);
    }
    if (userId) {
        where.assignment = { userId: String(userId) };
    }
    if (month) {
        where.date = { gte: monthStart(String(month)), lt: monthEnd(String(month)) };
    }

    const entries = await prisma.timeEntry.findMany({
        where,
        orderBy: { date: 'asc' },
        include: {
            assignment: {
                include: {
                    project: { select: { id: true, name: true } },
                    user: { select: { id: true, firstName: true, lastName: true } },
                },
            },
        },
    });

    res.json(entries);
}

// Créer ou mettre à jour la déclaration d'un jour. Un même couple (affectation, jour)
// ne peut porter qu'un seul type (travaillé OU une absence).
export async function upsertTimeEntry(req: Request, res: Response) {
    const data = upsertSchema.parse(req.body);

    const assignment = await prisma.assignment.findUnique({ where: { id: data.assignmentId } });
    if (!assignment) {
        throw new ApiError(404, 'Affectation introuvable');
    }

    const entry = await prisma.timeEntry.upsert({
        where: { assignmentId_date: { assignmentId: data.assignmentId, date: data.date } },
        create: data,
        update: { quantity: data.quantity, type: data.type, comment: data.comment },
        include: { assignment: { include: { project: { select: { id: true, name: true } } } } },
    });

    res.status(201).json(entry);
}

export async function deleteTimeEntry(req: Request, res: Response) {
    await prisma.timeEntry.delete({ where: { id: req.params.id } });
    res.status(204).send();
}

// Résumé mensuel (statut de validation + commentaire). Retourne un objet par
// défaut (brouillon vide) si le consultant n'a encore rien enregistré ce mois-ci.
export async function getMonthlySummary(req: Request, res: Response) {
    const { userId, month } = summaryQuerySchema.parse(req.query);

    const summary = await prisma.monthlyTimesheet.findUnique({
        where: { userId_month: { userId, month: monthStart(month) } },
    });

    res.json(summary ?? { userId, month: monthStart(month), status: 'DRAFT', comment: null });
}

export async function upsertMonthlySummary(req: Request, res: Response) {
    const data = summaryUpdateSchema.parse(req.body);

    const summary = await prisma.monthlyTimesheet.upsert({
        where: { userId_month: { userId: data.userId, month: monthStart(data.month) } },
        create: {
            userId: data.userId,
            month: monthStart(data.month),
            comment: data.comment,
            status: data.status ?? 'DRAFT',
        },
        update: {
            ...(data.comment !== undefined ? { comment: data.comment } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
        },
    });

    res.json(summary);
}

// Export PDF de la feuille de temps (liste des jours + synthèse Production/Interne/Absence)
export async function exportTimesheetPdf(req: Request, res: Response) {
    const { userId, month } = summaryQuerySchema.parse(req.query);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'Consultant introuvable');

    const entries = await prisma.timeEntry.findMany({
        where: { date: { gte: monthStart(month), lt: monthEnd(month) }, assignment: { userId } },
        orderBy: { date: 'asc' },
        include: { assignment: { include: { project: { select: { name: true } } } } },
    });

    const summary = await prisma.monthlyTimesheet.findUnique({
        where: { userId_month: { userId, month: monthStart(month) } },
    });

    const monthLabel = monthStart(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CRA-${user.lastName}-${month}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('Feuille de temps');
    doc.fontSize(12).fillColor('#555').text(`${user.firstName} ${user.lastName} — ${monthLabel}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000').text(`Statut : ${STATUS_LABELS[summary?.status ?? 'DRAFT']}`);
    doc.moveDown();

    const colX = { date: 50, type: 140, project: 230, qty: 420 };
    const tableTop = doc.y;

    doc.fontSize(9).fillColor('#666');
    doc.text('Date', colX.date, tableTop, { width: 80 });
    doc.text('Type', colX.type, tableTop, { width: 80 });
    doc.text('Projet', colX.project, tableTop, { width: 180 });
    doc.text('Quantité', colX.qty, tableTop, { width: 80 });

    let y = tableTop + 16;
    doc.moveTo(50, y).lineTo(500, y).strokeColor('#ddd').stroke();
    y += 6;

    let production = 0;
    let interne = 0;
    let absence = 0;

    for (const e of entries) {
        if (y > doc.page.height - 120) {
            doc.addPage();
            y = 50;
        }

        doc.fontSize(9).fillColor('#000');
        doc.text(new Date(e.date).toLocaleDateString('fr-FR'), colX.date, y, { width: 80 });
        doc.text(TYPE_LABELS[e.type] ?? e.type, colX.type, y, { width: 80 });
        doc.text(e.assignment.project?.name ?? '', colX.project, y, { width: 180 });
        doc.text(`${e.quantity} j`, colX.qty, y, { width: 80 });
        y += 16;

        const qty = Number(e.quantity);
        if (e.type === 'WORKED') production += qty;
        else if (e.type === 'INTERNE') interne += qty;
        else absence += qty;
    }

    if (entries.length === 0) {
        doc.fontSize(9).fillColor('#999').text('Aucune journée déclarée ce mois-ci.', colX.date, y);
        y += 16;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(500, y).strokeColor('#ddd').stroke();
    y += 12;

    doc.fontSize(10).fillColor('#000');
    doc.text(`Production : ${production} j`, 50, y);
    y += 14;
    doc.text(`Interne : ${interne} j`, 50, y);
    y += 14;
    doc.text(`Absence : ${absence} j`, 50, y);
    y += 14;
    doc.font('Helvetica-Bold').text(`Total : ${production + interne + absence} j`, 50, y);
    doc.font('Helvetica');

    if (summary?.comment) {
        y += 30;
        doc.fontSize(10).fillColor('#000').text('Commentaires :', 50, y, { underline: true });
        y += 16;
        doc.fontSize(9).fillColor('#333').text(summary.comment, 50, y, { width: 450 });
    }

    doc.end();
}

// Génère le CRA "personnalisé" (mise en page proche d'un CRA de mission classique :
// jour par jour, total, phrase de synthèse, blocs de signature consultant/client) et l'écrit
// directement sur la réponse. Partagé par la route authentifiée (téléchargement) et la route
// de prévisualisation (affichage inline dans le navigateur, pour itérer sur la mise en page).
async function renderCraPdf(
    res: Response,
    userId: string,
    month: string,
    disposition: 'attachment' | 'inline'
) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'Consultant introuvable');

    const assignments = await prisma.assignment.findMany({
        where: { userId },
        include: {
            project: {
                include: {
                    client: { include: { contacts: true } },
                    intermediary: true,
                    contacts: { orderBy: { createdAt: 'asc' } },
                },
            },
        },
    });
    if (assignments.length === 0) {
        throw new ApiError(400, "Ce consultant n'a aucune affectation, impossible de générer un CRA");
    }

    const project = assignments[0].project;
    const client = project.client;
    const intermediary = project.intermediary;
    const clientAssignmentIds = assignments
        .filter((a) => a.project.clientId === client.id)
        .map((a) => a.id);
    // Contact "Contact :" (info générale) : toujours le premier contact client déclaré.
    const contact = client.contacts[0];
    // Signataire côté client : toujours le premier contact déclaré sur le PROJET (mission),
    // même si le projet en a plusieurs (un seul signataire affiché).
    const projectContact = project.contacts[0];

    const entries = await prisma.timeEntry.findMany({
        where: {
            date: { gte: monthStart(month), lt: monthEnd(month) },
            assignmentId: { in: clientAssignmentIds },
            type: 'WORKED',
        },
    });

    const entryByDay = new Map<number, { quantity: number; comment: string | null }>();
    for (const e of entries) {
        const day = new Date(e.date).getUTCDate();
        const prev = entryByDay.get(day);
        entryByDay.set(day, {
            quantity: (prev?.quantity ?? 0) + Number(e.quantity),
            comment: e.comment ?? prev?.comment ?? null,
        });
    }

    const [year, monthIndex] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthIndex, 0).getDate();
    const monthLabel = capitalize(monthStart(month).toLocaleDateString('fr-FR', { month: 'long' }));

    let total = 0;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="CRA-${user.lastName}-${month}.pdf"`);

    // Marge réduite et mise en page resserrée pour que le CRA (en-tête + tableau du mois +
    // bloc signatures) tienne toujours sur une seule page, même avec la ligne "Intermédiaire".
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    doc.pipe(res);

    // Logo client en haut à gauche, logo intermédiaire en haut à droite (les deux parties du CRA).
    const clientLogoBuffer = decodeLogo(client.logo);
    // if (clientLogoBuffer) {
    //     try {
    //         doc.image(clientLogoBuffer, 50, 32, { fit: [110, 55] });
    //     } catch {
    //         // Logo invalide/corrompu : on ignore silencieusement plutôt que de faire
    //         // échouer toute la génération du CRA.
    //     }
    // }

    // const logoBuffer = decodeLogo(clientLogoBuffer?.logo);
    if (clientLogoBuffer) {
        try {
            doc.image(clientLogoBuffer, 435, 32, { fit: [110, 55] });
        } catch {
            // Logo invalide/corrompu : on ignore silencieusement plutôt que de faire
            // échouer toute la génération du CRA.
        }
    }

    doc.fontSize(16).fillColor('#000').font('Helvetica-Bold').text("Compte Rendu d'Activité", { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(1);

    const infoLabelWidth = 90;
    function infoRow(label: string, value: string) {
        const rowY = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').text(label, 50, rowY, { width: infoLabelWidth });
        doc.font('Helvetica').text(value, 50 + infoLabelWidth, rowY, { width: 400 });
        doc.moveDown(0.6);
    }

    infoRow('Collab. :', `${user.lastName.toUpperCase()}  ${user.firstName}`);
    {
        const clientNameX = 50 + infoLabelWidth;
        doc.font('Helvetica').fontSize(10);
        const clientNameWidth = doc.widthOfString(client.name);
        doc.moveTo(clientNameX, doc.y - 3).lineTo(clientNameX + clientNameWidth, doc.y - 3).lineWidth(1.5).strokeColor('#dc2626').stroke();
        doc.lineWidth(1);
        infoRow('Client :', client.name);
        doc.moveTo(clientNameX, doc.y - 3).lineTo(clientNameX + clientNameWidth, doc.y - 3).lineWidth(1.5).strokeColor('#dc2626').stroke();
        doc.lineWidth(1);
    }
    infoRow('Mission :', project.name);

    if (intermediary) {
        // Mission passant par un intermédiaire : le "Contact" du CRA devient celui de
        // l'intermédiaire (c'est lui qui réceptionne le CRA), pas le contact client.
        const bits = [intermediary.contactName, intermediary.phone, intermediary.email].filter(Boolean);
        if (bits.length > 0) infoRow('Contact :', bits.join(' '.repeat(10)));
    } else if (contact) {
        const bits = [`${contact.firstName} ${contact.lastName}`, contact.phone, contact.email].filter(Boolean);
        infoRow('Contact :', bits.join(' '.repeat(10)));
    }
    // "CRA du mois :" et "Lang. :" sur la même ligne ; le mois/année a un fond gris, avec le
    // mois et l'année écartés pour occuper tout l'espace jusqu'à juste avant "Lang. :".
    {
        const rowY = doc.y;
        const monthYearX = 50 + infoLabelWidth;
        const monthYearPadding = 4;
        const langX = monthYearX + 180;
        const langGap = 12; // petit espace laissé avant "Lang. :"

        doc.fontSize(10).font('Helvetica-Bold').text('CRA du mois :', 50, rowY, { width: infoLabelWidth });
        doc.font('Helvetica');
        const yearText = String(year);
        const yearWidth = doc.widthOfString(yearText);
        const yearX = langX - langGap - yearWidth;
        const monthYearHeight = doc.heightOfString(monthLabel) + monthYearPadding * 2;

        doc.save();
        doc.fillColor('#d1d5db');
        doc.rect(
            monthYearX - monthYearPadding,
            rowY - monthYearPadding,
            yearX + yearWidth + monthYearPadding - (monthYearX - monthYearPadding),
            monthYearHeight
        ).fill();
        doc.restore();
        doc.fillColor('#000').text(monthLabel, monthYearX, rowY);
        doc.text(yearText, yearX, rowY);

        doc.font('Helvetica-Bold').text('Lang. :', langX, rowY, { width: 50 });
        doc.font('Helvetica').text('Français', langX + 50, rowY, { width: 100 });
        doc.moveDown(0.6);
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.8);

    const colX = { date: 50, jour: 90, qty: 200, astreintes: 290, comment: 370 };
    const colW = { date: 35, jour: 100, qty: 80, astreintes: 70, comment: 175 };

    function drawHeaderRow(rowY: number) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#555');
        doc.text('Date', colX.date, rowY, { width: colW.date });
        doc.text('Jour', colX.jour, rowY, { width: colW.jour });
        doc.text('Jour (n°)', colX.qty, rowY, { width: colW.qty });
        doc.text('Astreintes', colX.astreintes, rowY, { width: colW.astreintes });
        doc.text('Commentaires', colX.comment, rowY, { width: colW.comment });
        doc.font('Helvetica').fillColor('#000');
    }

    let y = doc.y;
    drawHeaderRow(y);
    y += 13;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 6;

    for (let day = 1; day <= daysInMonth; day++) {
        if (y > doc.page.height - 160) {
            doc.addPage();
            y = 36;
            drawHeaderRow(y);
            y += 13;
            doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
            y += 6;
        }

        const date = new Date(year, monthIndex - 1, day);
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const dayEntry = entryByDay.get(day);

        doc.fontSize(8).fillColor(isWeekend ? '#aaa' : '#000');
        doc.text(String(day), colX.date, y, { width: colW.date });
        // "Lundi" toujours en rouge, quel que soit l'état de la journée.
        doc.fillColor(dow === 1 ? '#dc2626' : isWeekend ? '#aaa' : '#000');
        doc.text(DOW_FULL_FR[dow], colX.jour, y, { width: colW.jour });
        doc.fillColor(isWeekend ? '#aaa' : '#000');

        // Fond gris derrière chaque valeur des colonnes "Jour (n°)", "Astreintes" et "Commentaires".
        doc.save();
        doc.fillColor('#e5e7eb');
        doc.rect(colX.qty - 2, y - 1, colW.qty, 10.5).fill();
        doc.rect(colX.astreintes - 2, y - 1, colW.astreintes, 10.5).fill();
        doc.rect(colX.comment - 2, y - 1, colW.comment, 10.5).fill();
        doc.restore();

        if (dayEntry) {
            doc.fillColor('#000').font('Helvetica-Bold').text(formatQty(dayEntry.quantity), colX.qty, y, { width: colW.qty });
            doc.font('Helvetica');
            total += dayEntry.quantity;
        } else {
            doc.fillColor(isWeekend ? '#aaa' : '#000').text('-', colX.qty, y, { width: colW.qty });
        }

        doc.fillColor(isWeekend ? '#aaa' : '#000').text('-', colX.astreintes, y, { width: colW.astreintes });

        if (dayEntry?.comment) {
            doc.fillColor('#000').fontSize(7).text(dayEntry.comment, colX.comment, y, { width: colW.comment });
            doc.fontSize(8);
        }

        y += 11;
    }

    y += 6;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 8;

    // Total mis en avant : gras, dans un cadre (même largeur que le tableau).
    {
        const totalText = `Nb de jours d'intervention : ${formatQty(total)}`;
        const totalPadding = 6;
        const totalBoxWidth = 495;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
        const totalTextHeight = doc.heightOfString(totalText, { width: totalBoxWidth - totalPadding * 2 });
        const totalBoxHeight = totalTextHeight + totalPadding * 2;

        doc.lineWidth(1.5).strokeColor('#000').rect(50, y, totalBoxWidth, totalBoxHeight).stroke();
        doc.lineWidth(1);
        doc.text(totalText, 50 + totalPadding, y + totalPadding, { width: totalBoxWidth - totalPadding * 2 });
        doc.font('Helvetica');

        y += totalBoxHeight + 10;
    }

    // Phrase de synthèse mise en avant : texte gras gris foncé dans un cadre au trait noir gras,
    // même largeur que le tableau (x=50 à x=545).
    const summarySentence = `En ${monthLabel} ${year}, ${user.lastName.toUpperCase()} ${user.firstName} a travaillé ${formatQty(total)} jour(s) en semaine pour ${project.name}.`;
    const boxPadding = 8;
    const boxWidth = 495;
    const boxX = 50;
    const boxY = y;

    doc.font('Helvetica-Bold').fontSize(9);
    const summaryTextHeight = doc.heightOfString(summarySentence, { width: boxWidth - boxPadding * 2 });
    const boxHeight = summaryTextHeight + boxPadding * 2;

    doc.lineWidth(1.5).strokeColor('#000').rect(boxX, boxY, boxWidth, boxHeight).stroke();
    doc.lineWidth(1);
    doc.fillColor('#333').text(summarySentence, boxX + boxPadding, boxY + boxPadding, {
        width: boxWidth - boxPadding * 2,
    });
    doc.font('Helvetica').fillColor('#000');

    y = boxY + boxHeight + 18;

    // Réserve la place du bloc signature (~122pt) + note de pied de page (~20pt) + marge (36pt).
    if (y > doc.page.height - 178) {
        doc.addPage();
        y = 36;
    }

    const sigColW = 240;
    const clientColX = 50 + sigColW + 20;
    // Trait gris clair sous Nom/Fonction/Signature/Date, côté "Signataire Client" uniquement
    // (ligne à compléter à la main pour Signature/Date).
    function clientGrayLine(atY: number) {
        doc.moveTo(clientColX, atY).lineTo(clientColX + sigColW, atY).lineWidth(0.75).strokeColor('#d1d5db').stroke();
        doc.lineWidth(1).strokeColor('#000');
    }

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Collaborateur :', 50, y);
    doc.text('Signataire Client Dûment Habilité :', clientColX, y);
    doc.font('Helvetica');
    y += 20;

    doc.fontSize(9);
    // Label à largeur fixe pour que les valeurs de Nom et Fonction démarrent au même niveau.
    const clientFieldLabelWidth = 55;
    doc.text(`Nom : ${user.lastName.toUpperCase()} ${user.firstName}`, 50, y, { width: sigColW });
    if (projectContact) {
        doc.text('Nom :', clientColX, y, { width: clientFieldLabelWidth });
        doc.text(`${projectContact.lastName.toUpperCase()}, ${projectContact.firstName}`, clientColX + clientFieldLabelWidth, y, {
            width: sigColW - clientFieldLabelWidth,
        });
    }
    clientGrayLine(y + 13);
    y += 16;

    if (projectContact?.role) {
        doc.text('Fonction :', clientColX, y, { width: clientFieldLabelWidth });
        doc.text(projectContact.role, clientColX + clientFieldLabelWidth, y, {
            width: sigColW - clientFieldLabelWidth,
        });
    }
    clientGrayLine(y + 13);
    y += 16;

    doc.text('Signature :', 50, y);
    doc.text('Signature :', clientColX, y);
    clientGrayLine(y + 34);
    y += 40;

    // Date du jour auto-remplie côté Collaborateur, au format jour.mois.année.
    const todayCra = new Date();
    const todayCraText = `${String(todayCra.getDate()).padStart(2, '0')}.${String(todayCra.getMonth() + 1).padStart(2, '0')}.${todayCra.getFullYear()}`;
    doc.text('Date :', 50, y);
    doc.text(todayCraText, 50 + doc.widthOfString('Date :') + 6, y);
    doc.text('Date :', clientColX, y);
    clientGrayLine(y + 22);
    y += 30;

    const returnEmail = intermediary?.email ?? contact?.email;
    if (returnEmail) {
        // Toujours collé en bas de page (pas juste après le bloc signature) : trait en gras
        // de même largeur que les séparateurs du tableau (x=50 à x=545), puis la note.
        // Marge de sécurité sous la limite bas-de-page de pdfkit pour ne jamais déclencher
        // un saut de page automatique.
        const bottomLimit = doc.page.height - doc.page.margins.bottom;
        const footerY = Math.max(y, bottomLimit - 16);
        doc.lineWidth(1.5).moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor('#000').stroke();
        doc.lineWidth(1);
        doc.fontSize(8)
            .fillColor('#666')
            .text(`Merci d'envoyer ce document signé par mail à l'adresse ${returnEmail}.`, 50, footerY, {
                width: 495,
                align: 'center',
            });
    }

    doc.end();
}

export async function exportTimesheetCra(req: Request, res: Response) {
    const { userId, month } = summaryQuerySchema.parse(req.query);
    await renderCraPdf(res, userId, month, 'attachment');
}

const previewQuerySchema = z.object({
    userId: z.string().min(1).optional(),
    month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
});

// Route de dev sans authentification (voir timesheet.routes.ts) : ouvrir l'URL directement dans
// le navigateur affiche le PDF inline, sans passer par un token ni par le flux /timesheets complet.
// Pratique pour itérer sur la mise en page du CRA. userId/month par défaut = la première affectation
// trouvée / le mois en cours, pour pouvoir ouvrir la route sans aucun paramètre.
export async function previewTimesheetCra(req: Request, res: Response) {
    const { userId: queryUserId, month: queryMonth } = previewQuerySchema.parse(req.query);

    const userId = queryUserId ?? (await prisma.assignment.findFirst())?.userId;
    if (!userId) {
        throw new ApiError(400, "Aucune affectation en base : impossible de choisir un consultant par défaut, passe ?userId=...");
    }

    const now = new Date();
    const month = queryMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await renderCraPdf(res, userId, month, 'inline');
}