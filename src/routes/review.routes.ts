import { review } from '@review/controllers/create.controller';
import { reviewsByGigId, reviewsBySellerId } from '@review/controllers/get.controller';
import express, { Router } from 'express';

const router: Router = express.Router();

const reviewRoutes = (): Router => {
  router.get('/gig/:gigId', reviewsByGigId);
  router.get('/seller/:sellerId', reviewsBySellerId);
  router.post('/', review);

  return router;
};

export { reviewRoutes };