import { Router } from 'express';
import {
    createAssignment,
    deleteAssignment,
    listAssignments,
    updateAssignment,
} from '../controllers/assignment.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCompanySetup } from '../middleware/companySetup';

const router = Router();

router.use(requireAuth);

router.get('/', listAssignments);
router.post('/', requireRole('ADMIN', 'MANAGER'), requireCompanySetup, createAssignment);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateAssignment);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), deleteAssignment);

export default router;
