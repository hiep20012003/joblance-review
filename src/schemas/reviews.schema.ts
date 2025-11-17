import {z} from 'zod';
import {ReviewType, sanitizeNumber} from '@hiep20012003/joblance-shared';

export const addReviewSchema = z.object({
    gigId: z.string(),
    reviewerId: z.string(),
    targetId: z.string(),
    targetPicture: z.string(),
    targetUsername: z.string(),
    review: z.string().min(10, 'Review cannot be empty.'),
    reviewerPicture: z.string(),
    rating: z.number().min(1, 'Rating must be at least 1.').max(5, 'Rating cannot be more than 5.'),
    orderId: z.string(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    reviewerUsername: z.string(),
    reply: z.string().optional(),
    reviewType: z.enum(ReviewType),
});

export type AddReviewSchema = z.infer<typeof addReviewSchema>;

export const replyReviewSchema = z.object({
    reviewId: z.string(),
    reply: z.string().min(1, 'Reply cannot be empty.'),
});

export type ReplyReviewSchema = z.infer<typeof replyReviewSchema>;

export const queryReviewsSchema = z.object({
    query: z.string().optional(),
    orderId: z.string().optional(),
    gigId: z.string().optional(),
    targetId: z.string().optional(),
    limit: sanitizeNumber(z.number().min(1).max(100)).default(10),
    page: sanitizeNumber(z.number().min(1)).default(1),
});

export type QueryReviewsSchema = z.infer<typeof queryReviewsSchema>;
