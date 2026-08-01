import { Router } from 'express';
import {
  createIntermediary,
  deleteIntermediary,
  getIntermediary,
  listIntermediaries,
  updateIntermediary,
} from '../controllers/intermediary.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCompanySetup } from '../middleware/companySetup';

const router = Router();

router.use(requireAuth);

router.get('/', listIntermediaries);
router.get('/:id', getIntermediary);
router.post('/', requireRole('ADMIN', 'MANAGER'), requireCompanySetup, createIntermediary);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateIntermediary);
router.delete('/:id', requireRole('ADMIN'), deleteIntermediary);

export default router;
