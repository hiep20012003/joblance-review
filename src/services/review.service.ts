import { database } from '@reviews/database/connection';
import { messageQueue, publishChannel } from '@reviews/queues/connection';
import {
    ConflictError,
    EXCHANGES,
    INotificationDocument,
    IReviewDocument,
    IReviewMessageQueue,
    MessageQueueType,
    NotFoundError,
    ReviewType,
    ROUTING_KEYS,
} from '@hiep20012003/joblance-shared';
import { AppLogger } from '@reviews/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ReplyReviewSchema, AddReviewSchema, QueryReviewsSchema } from '@reviews/schemas/reviews.schema';
import { PoolConnection } from 'mysql2/promise';
import { RequestContext } from '@reviews/utils/request-context';

export class ReviewService {
    private readonly objKeys: Record<string, string> = {
        id: 'id',
        gig_id: 'gigId',
        order_id: 'orderId',
        reviewer_id: 'reviewerId',
        reviewer_picture: 'reviewerPicture',
        reviewer_username: 'reviewerUsername',
        target_id: 'targetId',
        target_picture: 'targetPicture',
        target_username: 'targetUsername',
        review: 'review',
        rating: 'rating',
        review_type: 'reviewType',
        reply: 'reply',
        is_public: 'isPublic',
        created_at: 'createdAt',
    };

    /** ===================== ADD REVIEW ===================== */
    public async addReview(data: AddReviewSchema): Promise<IReviewDocument> {
        return database.runTransaction(async (conn: PoolConnection) => {
            const {
                gigId,
                orderId,
                reviewerId,
                reviewerPicture,
                reviewerUsername,
                targetId,
                targetPicture,
                targetUsername,
                review,
                rating,
                reviewType,
            } = data;

            // Lock các review của order để tránh race condition (MySQL InnoDB hỗ trợ SELECT ... FOR UPDATE)
            const [existingReviews] = await conn.query(
                `SELECT * FROM reviews WHERE order_id = ? FOR UPDATE`,
                [orderId]
            ) as [any[], any];

            if (existingReviews.length >= 2) {
                throw new ConflictError({
                    clientMessage: 'Both buyer and seller have already reviewed this order.',
                    operation: 'reviews:add',
                });
            }

            const createdAt = new Date();
            const isPublic = existingReviews.length === 1; // Chỉ review thứ 2 mới bật public

            const reviewId = uuidv4();

            // Insert review mới
            await conn.query(
                `INSERT INTO reviews(
          id, gig_id, order_id,
          reviewer_id, reviewer_username, reviewer_picture,
          target_id, target_username, target_picture,
          review, rating, review_type, reply, is_public, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    reviewId,
                    gigId,
                    orderId,
                    reviewerId,
                    reviewerUsername,
                    reviewerPicture,
                    targetId,
                    targetUsername,
                    targetPicture,
                    review,
                    rating,
                    reviewType,
                    null,
                    isPublic,
                    createdAt,
                ]
            );

            const [insertedRows] = await conn.query(
                `SELECT * FROM reviews WHERE id = ?`,
                [reviewId]
            ) as [any[], any];

            if (insertedRows.length === 0) {
                throw new Error('Failed to retrieve newly inserted review');
            }

            const newReviewRow = insertedRows[0];
            const newReview = this.mapRowToReview(newReviewRow);

            // Nếu đây là review thứ 2 → bật public + publish cả 2 review
            if (isPublic) {
                await this.makeReviewsPublicAndPublish(conn, orderId, [...existingReviews, newReviewRow]);
            } else {
                AppLogger.info('Review added (private - waiting for second review)', {
                    operation: 'reviews:add-private',
                    context: { orderId, reviewerId },
                });
            }

            return newReview;
        });
    }

    public async makeReviewsPublicAndPublish(
        conn: PoolConnection,
        orderId: string,
        reviews: any[] // IReviewDocument[]
    ): Promise<void> {
        // 1. Cập nhật tất cả review của order thành public
        await conn.query(
            `UPDATE reviews SET is_public = true WHERE order_id = ?`,
            [orderId]
        );

        const exchange = EXCHANGES.REVIEWS.name;

        // 2. Duyệt từng review và publish
        for (const rev of reviews) {
            const isBuyerReview = rev.review_type === ReviewType.BUYER;

            const routingKey = isBuyerReview
                ? ROUTING_KEYS.REVIEWS.SELLER_REVIEWED
                : ROUTING_KEYS.REVIEWS.BUYER_REVIEWED;

            const messageType = isBuyerReview
                ? MessageQueueType.SELLER_REVIEWED
                : MessageQueueType.BUYER_REVIEWED;

            const notification: INotificationDocument = {
                recipient: {
                    id: rev.target_id,
                    role: isBuyerReview ? 'seller' : 'buyer',
                    username: rev.reviewer_username,
                    avatar: rev.reviewer_picture || '',
                },
                payload: {
                    message: 'gave you a review.',
                    extra: { orderId },
                },
                actor: {
                    id: rev.reviewer_id,
                    role: isBuyerReview ? 'buyer' : 'seller',
                    username: rev.target_username,
                    avatar: rev.target_picture || '',
                },
                timestamp: new Date(rev.created_at).toISOString(),
            };

            const message: IReviewMessageQueue = {
                type: messageType,
                notification,
                reviewId: rev.id,
                orderId: rev.order_id,
                gigId: rev.gig_id,
                reviewerId: rev.reviewer_id,
                targetId: rev.target_id,
                review: rev.review,
                rating: rev.rating,
                createdAt: new Date(rev.created_at).toISOString(),
            };

            await messageQueue.publish({
                channelName: publishChannel,
                exchange,
                routingKey,
                message: JSON.stringify(message),
            });
        }

        AppLogger.info('Both reviews are now public → published to queue', {
            operation: 'reviews:make-public-and-publish',
            context: { reviewCount: reviews.length, orderId },
        });
    }

    /** ===================== REPLY REVIEW ===================== */
    public async replyReview(data: ReplyReviewSchema): Promise<IReviewDocument> {
        return database.runTransaction(async (conn: PoolConnection) => {
            const { reviewId, reply } = data;

            await conn.query(
                `UPDATE reviews
         SET reply = ?
         WHERE id = ? AND review_type = ?`,
                [reply, reviewId, ReviewType.SELLER]
            );

            // Lấy lại review sau khi update
            const [updatedRows] = await conn.query(
                `SELECT * FROM reviews WHERE id = ?`,
                [reviewId]
            ) as [any[], any];

            if (updatedRows.length === 0) {
                throw new NotFoundError({
                    clientMessage: 'Review not found or you are not allowed to reply.',
                    operation: 'reviews:reply',
                });
            }

            const review = this.mapRowToReview(updatedRows[0]);

            const exchange = EXCHANGES.REVIEWS.name;
            const routingKey = ROUTING_KEYS.REVIEWS.SELLER_REPLIED;

            const notification: INotificationDocument = {
                recipient: {
                    id: review.targetId,
                    role: 'buyer',
                    username: review.reviewerUsername,
                    avatar: review.reviewerPicture || '',
                },
                payload: {
                    message: 'replied to your review.',
                    extra: { orderId: review.orderId },
                },
                actor: {
                    id: review.reviewerId,
                    role: 'seller',
                    username: review.targetUsername,
                    avatar: review.targetPicture || '',
                },
                timestamp: new Date().toISOString(),
            };

            const message: IReviewMessageQueue = {
                type: MessageQueueType.SELLER_REPLIED,
                notification,
                orderId: review.orderId,
                gigId: review.gigId,
                reviewerId: review.reviewerId,
                targetId: review.targetId,
                review: review.review,
                rating: review.rating,
                createdAt: new Date(review.createdAt).toISOString(),
            };

            await messageQueue.publish({
                channelName: publishChannel,
                exchange,
                routingKey,
                message: JSON.stringify(message),
            });

            AppLogger.info('Seller reply published to queue', {
                operation: 'reviews:reply-published',
                context: { reviewId },
            });

            return review;
        });
    }

    /** ===================== QUERY REVIEWS ===================== */
    public async queryReviews(params: QueryReviewsSchema): Promise<IReviewDocument[]> {
        const { query, orderId, gigId, targetId, limit = 20, page = 1 } = params;
        const userId = RequestContext.getUserId();

        const conditions: string[] = [];
        const values: any[] = [];

        if (userId) {
            conditions.push(`(reviewer_id = ? OR is_public = TRUE)`);
            values.push(userId);
        } else {
            conditions.push(`is_public = TRUE`);
        }

        if (orderId) {
            conditions.push(`order_id = ?`);
            values.push(orderId);
        }
        if (gigId) {
            conditions.push(`gig_id = ?`);
            values.push(gigId);
        }
        if (targetId) {
            conditions.push(`target_id = ?`);
            values.push(targetId);
        }
        if (query) {
            const likeQuery = `%${query}%`;
            conditions.push(`(
        review LIKE ? OR
        reviewer_username LIKE ? OR
        target_username LIKE ?
      )`);
            values.push(likeQuery, likeQuery, likeQuery);
        }

        if (conditions.length === 0) return [];

        const offset = (page - 1) * limit;

        const sql = `
            SELECT *
            FROM reviews
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        values.push(limit, offset);

        const [rows] = await database.getPool().query(sql, values) as [any[], any];

        return rows.map(this.mapRowToReview.bind(this));
    }

    /** ===================== HELPER ===================== */
    private mapRowToReview(row: Record<string, any>): IReviewDocument {
        return Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
                this.objKeys[key] || key,
                value,
            ])
        ) as IReviewDocument;
    }
}

export const reviewService = new ReviewService();