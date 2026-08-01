import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: false,
});

export async function sendPasswordChangedEmail(to: string, firstName: string) {
    await transporter.sendMail({
        from: env.smtpFrom,
        to,
        subject: 'Votre mot de passe Pilot Manager a été modifié',
        text: `Bonjour ${firstName},\n\nLe mot de passe de votre compte BoondClone vient d'être modifié par un administrateur.\n\nSi vous n'êtes pas à l'origine de cette action, contactez votre administrateur immédiatement.`,
    });
}

interface InvoiceEmailInfo {
    number: string;
    periodLabel: string;
    totalAmount: string;
}

export async function sendInvoiceToClientEmail(to: string, clientName: string, invoice: InvoiceEmailInfo) {
    await transporter.sendMail({
        from: env.smtpFrom,
        to,
        subject: `Facture ${invoice.number} - ${invoice.periodLabel}`,
        text: `Bonjour,\n\nVeuillez trouver ci-joint la facture ${invoice.number} pour ${clientName}, période ${invoice.periodLabel}, d'un montant de ${invoice.totalAmount}.\n\nCordialement.`,
    });
}

export async function sendInvoiceToConsultantEmail(
    to: string,
    firstName: string,
    invoice: InvoiceEmailInfo
) {
    await transporter.sendMail({
        from: env.smtpFrom,
        to,
        subject: `Facture ${invoice.number} - ${invoice.periodLabel}`,
        text: `Bonjour ${firstName},\n\nLa facture ${invoice.number} correspondant à ton activité de ${invoice.periodLabel} (montant total : ${invoice.totalAmount}) vient d'être envoyée au client.\n\nCordialement.`,
    });
}
