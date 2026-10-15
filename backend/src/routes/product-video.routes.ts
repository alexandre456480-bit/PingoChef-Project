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

// This router and itemRoutes share /items. Keep the same authentication on
// every media endpoint, without running it on unmatched ordinary CRUD paths.
router.post('/media/publish-ready', authenticateJwt as any, publishReadyMediaController as any);
router.get('/:itemId/media', authenticateJwt as any, listProductMediaController as any);
router.post('/:itemId/media/video/upload-intent', authenticateJwt as any, createVideoUploadIntentController as any);
router.post('/:itemId/media/:mediaId/playback', authenticateJwt as any, createOwnerPreviewPlaybackController as any);
router.delete('/:itemId/media/:mediaId', authenticateJwt as any, deleteProductVideoController as any);

export default router;
