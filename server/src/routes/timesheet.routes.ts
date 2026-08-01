import { Router } from 'express';
import {
    deleteTimeEntry,
    exportTimesheetCra,
    exportTimesheetPdf,
    getMonthlySummary,
    listTimeEntries,
    previewTimesheetCra,
    upsertMonthlySummary,
    upsertTimeEntry,
} from '../controllers/timesheet.controller';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Route de dev, volontairement placée AVANT requireAuth : permet d'ouvrir l'URL directement
// dans le navigateur (pas de bearer token possible en navigation directe) pour visualiser/itérer
// sur la mise en page du CRA. Désactivée en production.
if (env.nodeEnv !== 'production') {
    router.get('/cra-preview', previewTimesheetCra);
}

router.use(requireAuth);

router.get('/summary', getMonthlySummary);
router.patch('/summary', upsertMonthlySummary);
router.get('/pdf', exportTimesheetPdf);
router.get('/cra', exportTimesheetCra);

router.get('/', listTimeEntries);
router.post('/', upsertTimeEntry);
router.delete('/:id', deleteTimeEntry);

export default router;
