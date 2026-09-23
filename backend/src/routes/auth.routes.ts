import { Router } from 'express';
import { registerController, activateController, loginController } from '../controllers/auth.controller';

const router = Router();

// Rota de Cadastro de Novo Estabelecimento
router.post('/register', registerController);

// Rota de Ativação por Token (ACT-XXXX)
router.post('/activate', activateController);

// Rota de Login
router.post('/login', loginController);

export default router;
