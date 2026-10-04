import { Router } from 'express';
import {
  companyStatus,
  emailAvailable,
  login,
  me,
  register,
  resendVerification,
  verifyEmail,
} from '../controllers/auth.controller';
import { searchCompanies } from '../controllers/company.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, me);

// Inscription en libre-service (routes publiques)
router.get('/register/company-search', searchCompanies);
router.get('/register/company-status', companyStatus);
router.get('/register/email-available', emailAvailable);
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

export default router;
