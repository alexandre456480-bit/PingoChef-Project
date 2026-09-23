import { Router } from 'express';
import { getBusinessController, updateBusinessController } from '../controllers/business.controller';
import { authenticateJwt } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas de gerenciamento da empresa exigem autenticação JWT
router.use(authenticateJwt as any);

router.get('/', getBusinessController as any);
router.put('/', updateBusinessController as any);

export default router;
