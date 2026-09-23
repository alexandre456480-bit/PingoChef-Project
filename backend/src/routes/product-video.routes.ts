import { Router } from 'express';
import {
  createVideoUploadIntentController,
  deleteProductVideoController,
  listProductMediaController
} from '../controllers/product-video.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import {
  createOwnerPreviewPlaybackController,
  publishReadyMediaController
} from '../controllers/product-playback.controller';

const router = Router();

router.use(authenticateJwt as any);
router.post('/media/publish-ready', publishReadyMediaController as any);
router.get('/:itemId/media', listProductMediaController as any);
router.post('/:itemId/media/video/upload-intent', createVideoUploadIntentController as any);
router.post('/:itemId/media/:mediaId/playback', createOwnerPreviewPlaybackController as any);
router.delete('/:itemId/media/:mediaId', deleteProductVideoController as any);

export default router;
