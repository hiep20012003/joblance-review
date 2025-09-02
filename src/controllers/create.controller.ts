import { addReview } from '@review/services/review.service';
import { IReviewDocument } from @hiep20012003/joblance-shared';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const review = async (req: Request, res: Response): Promise<void> => {
  const review: IReviewDocument = await addReview(req.body);
  res.status(StatusCodes.CREATED).json({ message: 'Review created successfully.', review });
};
// hỏi hiệp có cần kiu gpt viết lại theo cấu trúc class ko
