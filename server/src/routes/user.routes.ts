import { Router } from 'express';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCompanySetup } from '../middleware/companySetup';

const router = Router();

router.use(requireAuth);

router.get('/', listUsers);
router.post('/', requireRole('ADMIN'), requireCompanySetup, createUser);
router.patch('/:id', requireRole('ADMIN'), updateUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);

export default router;
