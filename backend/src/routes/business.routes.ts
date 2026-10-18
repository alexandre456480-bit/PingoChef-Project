import { Router } from 'express';
import { getBusinessController, updateBusinessController,
  publishBusinessMenuController } from '../controllers/business.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { getTutorial, updateTutorial } from '../controllers/tutorial.controller';

const router = Router();

// Todas as rotas de gerenciamento da empresa exigem autenticação JWT
router.use(authenticateJwt as any);

router.get('/', getBusinessController as any);
router.put('/', updateBusinessController as any);
router.post('/publish', publishBusinessMenuController as any);
router.get('/tutorial', getTutorial as any);
router.patch('/tutorial', updateTutorial as any);

export default router;
