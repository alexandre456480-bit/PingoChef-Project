import { Router } from 'express';
import { reconcileVideosController } from '../controllers/product-video.controller';

const router = Router();

router.post('/reconcile', reconcileVideosController as any);

export default router;

