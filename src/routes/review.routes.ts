import express, { Router } from 'express';
import { reviewController } from '@review/controllers/review.controller';

class ReviewRoutes {
  private router: Router;
  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/gig/:gigId', reviewController.reviewsByGigId);
    this.router.get('/seller/:sellerId', reviewController.reviewsBySellerId);
    this.router.post('/', reviewController.review);
    return this.router;
  }
}

export const reviewRoutes: ReviewRoutes = new ReviewRoutes();
