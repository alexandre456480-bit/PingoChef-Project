import { Router } from 'express';
import { requireOwnerOrigin, ownerLogin, ownerRegister, ownerMe, ownerLogout, ownerEmailRequest,
  ownerConfirmEmail, ownerRecoverySession, ownerResetPassword, ownerMigrateSession, ownerCompleteRegistration } from '../controllers/owner-auth.controller';
import rateLimit from 'express-rate-limit';
import { ownerPlans, ownerCreatePlanIntent, ownerReadPlanIntent, ownerChangePassword, ownerDeleteAccount } from '../controllers/owner-commercial.controller';

const router = Router();
router.get('/plans', ownerPlans);
router.post('/plan-intents', rateLimit({ windowMs: 30*60*1000, limit: 20, standardHeaders: true, legacyHeaders: false }), requireOwnerOrigin, ownerCreatePlanIntent);
router.get('/plan-intents/:id', rateLimit({ windowMs: 15*60*1000, limit: 60, standardHeaders: true, legacyHeaders: false }), ownerReadPlanIntent);
router.post('/change-password', ownerChangePassword);
router.post('/delete-account', ownerDeleteAccount);

// Rota de Cadastro de Novo Estabelecimento
router.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), requireOwnerOrigin, ownerRegister);

// Rota de Ativação por Token (ACT-XXXX)

// Rota de Login
router.post('/login', requireOwnerOrigin, ownerLogin);
router.get('/me', ownerMe);
router.post('/logout', ownerLogout());
router.post('/logout-all', ownerLogout(true));
router.post('/forgot-password', requireOwnerOrigin, ownerEmailRequest(true));
router.post('/resend-confirmation', requireOwnerOrigin, ownerEmailRequest());
router.get('/confirm-email', ownerConfirmEmail());
router.get('/recover', ownerConfirmEmail(true));
router.get('/recovery-session', ownerRecoverySession);
router.post('/reset-password', ownerResetPassword);
router.post('/complete-registration', ownerCompleteRegistration);
router.post('/migrate-session', requireOwnerOrigin, ownerMigrateSession);

export default router;
