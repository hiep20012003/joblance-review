import express, {Router} from 'express';
import {reviewController} from '@reviews/controllers/review.controller';
import {handleAsyncError, validate, validateQueryMiddleware} from '@hiep20012003/joblance-shared';
import {addReviewSchema, queryReviewsSchema, replyReviewSchema} from '@reviews/schemas/reviews.schema';

class ReviewRoutes {
    private readonly router: Router;

    constructor() {
        this.router = express.Router();
    }

    public routes(): Router {
        this.router.get('/reviews', validateQueryMiddleware(queryReviewsSchema), handleAsyncError(reviewController.queryReviews));
        this.router.post('/reviews', validate(addReviewSchema), handleAsyncError(reviewController.review));
        this.router.patch('/reviews/reply', validate(replyReviewSchema), handleAsyncError(reviewController.replyReview));
        return this.router;
    }
}

export const reviewRoutes: ReviewRoutes = new ReviewRoutes();
