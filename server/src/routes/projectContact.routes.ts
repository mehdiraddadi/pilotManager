import { Router } from 'express';
import {
  createProjectContact,
  deleteProjectContact,
  updateProjectContact,
} from '../controllers/projectContact.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('ADMIN', 'MANAGER'), createProjectContact);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateProjectContact);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), deleteProjectContact);

export default router;
