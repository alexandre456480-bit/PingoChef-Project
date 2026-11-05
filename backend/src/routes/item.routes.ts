import { Router } from 'express';
import { 
  getItemsController, 
  createItemController, 
  updateItemController, 
  toggleItemAvailabilityController, 
  deleteItemController,
  reorderItemsController 
} from '../controllers/item.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { productRecommendationsController } from '../controllers/product-recommendations.controller';

const router = Router();

// Aplicar Middleware de Autenticação em todas as rotas de Produtos
router.use(authenticateJwt as any);

router.get('/', getItemsController as any);
router.get('/:id/recommendations', productRecommendationsController as any);
router.put('/:id/recommendations', productRecommendationsController as any);
router.post('/', createItemController as any);
router.patch('/reorder', reorderItemsController as any);
router.patch('/:id/toggle-availability', toggleItemAvailabilityController as any);
router.put('/:id', updateItemController as any);
router.delete('/:id', deleteItemController as any);

export default router;
