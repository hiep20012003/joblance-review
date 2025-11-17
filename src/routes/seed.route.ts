import {Router} from 'express';
import {seedReviews, deleteSeededReviews} from '@reviews/controllers/seed.controller';

const router = Router();

router.post('/reviews', seedReviews);
router.delete('/reviews', deleteSeededReviews);

export default router;
