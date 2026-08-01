import { Router } from 'express';
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from '../controllers/client.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCompanySetup } from '../middleware/companySetup';

const router = Router();

router.use(requireAuth);

router.get('/', listClients);
router.get('/:id', getClient);
router.post('/', requireRole('ADMIN', 'MANAGER'), requireCompanySetup, createClient);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateClient);
router.delete('/:id', requireRole('ADMIN'), deleteClient);

export default router;
