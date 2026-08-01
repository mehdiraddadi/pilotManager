import { Router } from 'express';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../controllers/project.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCompanySetup } from '../middleware/companySetup';

const router = Router();

router.use(requireAuth);

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', requireRole('ADMIN', 'MANAGER'), requireCompanySetup, createProject);
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateProject);
router.delete('/:id', requireRole('ADMIN'), deleteProject);

export default router;
