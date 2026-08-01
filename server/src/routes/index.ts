import { Router } from 'express';
import authRoutes from './auth.routes';
import clientRoutes from './client.routes';
import projectRoutes from './project.routes';
import userRoutes from './user.routes';
import assignmentRoutes from './assignment.routes';
import timesheetRoutes from './timesheet.routes';
import invoiceRoutes from './invoice.routes';
import intermediaryRoutes from './intermediary.routes';
import contactRoutes from './contact.routes';
import projectContactRoutes from './projectContact.routes';
import companyRoutes from './company.routes';
import companyContactRoutes from './companyContact.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/company', companyRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/users', userRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/timesheets', timesheetRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/intermediaries', intermediaryRoutes);
router.use('/contacts', contactRoutes);
router.use('/project-contacts', projectContactRoutes);
router.use('/company-contacts', companyContactRoutes);

// À venir : /candidates...

export default router;
