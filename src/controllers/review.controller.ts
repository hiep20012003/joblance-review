import {Request, Response} from 'express';
import {StatusCodes, ReasonPhrases} from 'http-status-codes';
import {IReviewDocument, SuccessResponse} from '@hiep20012003/joblance-shared';
import {reviewService} from '@reviews/services/review.service';
import {AddReviewSchema, QueryReviewsSchema, ReplyReviewSchema} from '@reviews/schemas/reviews.schema';

class ReviewController {
    queryReviews = async (req: Request, res: Response): Promise<void> => {
        const validatedQuery: QueryReviewsSchema = req.validatedQuery;
        const reviews: IReviewDocument[] = await reviewService.queryReviews(validatedQuery);
        new SuccessResponse({
            message: 'Reviews fetched successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: reviews
        }).send(res);
    };

    review = async (req: Request, res: Response): Promise<void> => {
        const validatedBody: AddReviewSchema = req.body as AddReviewSchema;
        const review: IReviewDocument = await reviewService.addReview(validatedBody);
        new SuccessResponse({
            message: 'Review created successfully',
            statusCode: StatusCodes.CREATED,
            reasonPhrase: ReasonPhrases.CREATED,
            data: review
        }).send(res);
    };

    replyReview = async (req: Request, res: Response): Promise<void> => {
        const validatedBody: ReplyReviewSchema = req.body as ReplyReviewSchema;
        const review: IReviewDocument = await reviewService.replyReview(validatedBody);
        new SuccessResponse({
            message: 'Review replied successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: review
        }).send(res);
    };
}

export const reviewController = new ReviewController();
