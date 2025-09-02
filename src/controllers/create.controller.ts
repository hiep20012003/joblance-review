import { SuccessResponse } from '@hiep20012003/joblance-shared';
import { reviewService } from '@review/services/review.service';
import { IReviewDocument } from '@review/types/review';
import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export const review = async (req: Request, res: Response): Promise<void> => {
  const review: IReviewDocument = await reviewService.addReview(req.body as IReviewDocument);
  new SuccessResponse({
    message: 'User created successfully',
    statusCode: StatusCodes.CREATED,
    reasonPhrase: ReasonPhrases.CREATED,
    metadata: { review }
  }).send(res);
};
// hỏi hiệp có cần kiu gpt viết lại theo cấu trúc class ko
