import { Router } from 'express';
import { createContact, deleteContact, updateContact } from '../controllers/contact.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('ADMIN', 'MANAGER'), createContact);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateContact);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), deleteContact);

export default router;
