import express, { Router } from 'express';
import { muxWebhookController } from '../controllers/product-video.controller';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  muxWebhookController as any
);

export default router;

