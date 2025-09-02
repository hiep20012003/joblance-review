import { SuccessResponse } from '@hiep20012003/joblance-shared';
import { reviewService } from '@review/services/review.service';
import { IReviewDocument } from '@review/types/review';
import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export const reviewsByGigId = async (req: Request, res: Response): Promise<void> => {
  const reviews: IReviewDocument[] = await reviewService.getReviewsByGigId(req.params.gigId);
  new SuccessResponse({
    message: 'User created successfully',
    statusCode: StatusCodes.CREATED,
    reasonPhrase: ReasonPhrases.CREATED,
    metadata: { reviews }
  }).send(res);
};

export const reviewsBySellerId = async (req: Request, res: Response): Promise<void> => {
  const reviews: IReviewDocument[] = await reviewService.getReviewsBySellerId(req.params.sellerId);
  new SuccessResponse({
    message: 'User created successfully',
    statusCode: StatusCodes.CREATED,
    reasonPhrase: ReasonPhrases.CREATED,
    metadata: { reviews }
  }).send(res);
};
// hỏi hiệp có cần kiu gpt viết lại theo cấu trúc class ko
