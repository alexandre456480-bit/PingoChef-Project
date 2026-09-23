import { Router } from 'express';
import { 
  getCategoriesController, 
  createCategoryController, 
  updateCategoryController, 
  reorderCategoriesController, 
  deleteCategoryController 
} from '../controllers/category.controller';
import { authenticateJwt } from '../middleware/auth.middleware';

const router = Router();

// Aplicar Middleware de Autenticação em todas as rotas de Categorias
router.use(authenticateJwt as any);

router.get('/', getCategoriesController as any);
router.post('/', createCategoryController as any);
router.patch('/reorder', reorderCategoriesController as any);
router.put('/:id', updateCategoryController as any);
router.delete('/:id', deleteCategoryController as any);

export default router;
