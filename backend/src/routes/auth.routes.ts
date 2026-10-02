import { Router } from 'express';
import { loginController } from '../controllers/customer-login.controller';
import { invitationRegisterController } from '../controllers/invitation-registration.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rota de Cadastro de Novo Estabelecimento
router.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), invitationRegisterController);

// Rota de Ativação por Token (ACT-XXXX)

// Rota de Login
router.post('/login', loginController);

export default router;
