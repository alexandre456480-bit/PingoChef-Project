import { Router } from 'express';
import { getDesignController, saveDesignController } from '../controllers/design.controller';
import { authenticateJwt } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJwt as any);

router.get('/', getDesignController as any);
router.put('/', saveDesignController as any);

export default router;
