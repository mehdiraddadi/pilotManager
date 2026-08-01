import { Router } from 'express';
import {
    deleteInvoice,
    exportInvoicePdf,
    generateInvoice,
    getInvoice,
    listInvoices,
    previewInvoice,
    sendInvoiceToClient,
    sendInvoiceToConsultant,
    updateInvoiceStatus,
} from '../controllers/invoice.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Route de dev, volontairement placée AVANT requireAuth : permet d'ouvrir l'URL directement
// dans le navigateur (pas de bearer token possible en navigation directe) pour visualiser/itérer
// sur la mise en page de la facture. Désactivée en production.
if (env.nodeEnv !== 'production') {
    router.get('/invoice-preview', previewInvoice);
    // Idem pour une vraie facture déjà générée : permet d'ouvrir /invoices/:id/pdf directement
    // au navigateur sans passer par l'UI (pratique pour tester). Désactivé en production : ces
    // PDF contiennent des données réelles (client, montants, IBAN) et ne doivent pas être
    // accessibles sans authentification hors dev.
    router.get('/:id/pdf', exportInvoicePdf);
}

router.use(requireAuth);

router.get('/', listInvoices);
router.get('/:id', getInvoice);
if (env.nodeEnv === 'production') {
    router.get('/:id/pdf', exportInvoicePdf);
}
router.post('/generate', requireRole('ADMIN', 'MANAGER'), generateInvoice);
router.post('/:id/send-client', requireRole('ADMIN', 'MANAGER'), sendInvoiceToClient);
router.post('/:id/send-consultant', requireRole('ADMIN', 'MANAGER'), sendInvoiceToConsultant);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateInvoiceStatus);
router.delete('/:id', requireRole('ADMIN'), deleteInvoice);

export default router;
