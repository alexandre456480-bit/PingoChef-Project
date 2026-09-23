import { Router } from 'express';
import {
  getSubcategoriesController,
  createSubcategoryController,
  updateSubcategoryController,
  deleteSubcategoryController,
  reorderSubcategoriesController
} from '../controllers/subcategory.controller';
import { authenticateJwt } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJwt as any);

router.get('/', getSubcategoriesController as any);
router.post('/', createSubcategoryController as any);
router.patch('/reorder', reorderSubcategoriesController as any);
router.put('/:id', updateSubcategoryController as any);
router.delete('/:id', deleteSubcategoryController as any);

export default router;
