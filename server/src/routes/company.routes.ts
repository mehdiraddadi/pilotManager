import { Router } from 'express';
import { createCompany, getCompany, searchCompanies, updateCompany } from '../controllers/company.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/search', requireRole('ADMIN', 'MANAGER'), searchCompanies);
router.get('/', getCompany);
router.post('/', requireRole('ADMIN'), createCompany);
router.patch('/:id', requireRole('ADMIN'), updateCompany);

export default router;
