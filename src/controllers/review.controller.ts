import { Request, Response } from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { IReviewDocument, SuccessResponse } from '@hiep20012003/joblance-shared';
import { reviewService } from '@review/services/review.service';

class ReviewController {
  reviewsByGigId = async (req: Request, res: Response): Promise<void> => {
    const reviews: IReviewDocument[] = await reviewService.getReviewsByGigId(req.params.gigId);
    new SuccessResponse({
      message: 'User created successfully',
      statusCode: StatusCodes.CREATED,
      reasonPhrase: ReasonPhrases.CREATED,
      metadata: { reviews }
    }).send(res);
  };
  
  reviewsBySellerId = async (req: Request, res: Response): Promise<void> => {
    const reviews: IReviewDocument[] = await reviewService.getReviewsBySellerId(req.params.sellerId);
    new SuccessResponse({
      message: 'User created successfully',
      statusCode: StatusCodes.CREATED,
      reasonPhrase: ReasonPhrases.CREATED,
      metadata: { reviews }
    }).send(res);
  };

  review = async (req: Request, res: Response): Promise<void> => {
    const review: IReviewDocument = await reviewService.addReview(req.body as IReviewDocument);
    new SuccessResponse({
      message: 'User created successfully',
      statusCode: StatusCodes.CREATED,
      reasonPhrase: ReasonPhrases.CREATED,
      metadata: { review }
    }).send(res);
  };
}

export const reviewController = new ReviewController();
