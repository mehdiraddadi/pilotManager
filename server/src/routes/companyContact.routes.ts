import { Router } from 'express';
import {
    createCompanyContact,
    deleteCompanyContact,
    updateCompanyContact,
} from '../controllers/companyContact.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('ADMIN'), createCompanyContact);
router.patch('/:id', requireRole('ADMIN'), updateCompanyContact);
router.delete('/:id', requireRole('ADMIN'), deleteCompanyContact);

export default router;
