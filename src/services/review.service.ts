import {database} from '@reviews/database/connection';
import {messageQueue, publishChannel} from '@reviews/queues/connection';
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
import {AppLogger} from '@reviews/utils/logger';
import {v4 as uuidv4} from 'uuid';
import {ReplyReviewSchema, AddReviewSchema, QueryReviewsSchema} from '@reviews/schemas/reviews.schema';
import {PoolClient} from 'pg';
import {RequestContext} from "@reviews/utils/request-context";

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
        return database.runTransaction(async (client) => {
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

            // Lock order reviews
            const {rows: orderReviews} = await client.query(
                `SELECT *
                 FROM reviews
                 WHERE order_id = $1 FOR UPDATE`,
                [orderId]
            );

            if (orderReviews.length >= 2) {
                throw new ConflictError({
                    clientMessage: 'Both buyer and seller have already reviewed this order.',
                    operation: 'reviews:add',
                });
            }

            const createdAt = new Date();
            const isPublic = orderReviews.length === 1;

            const {rows: newReviews} = await client.query<IReviewDocument>(
                `INSERT INTO reviews(id, gig_id, order_id,
                                     reviewer_id, reviewer_username, reviewer_picture,
                                     target_id, target_username, target_picture,
                                     review, rating, review_type, reply, is_public, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 RETURNING *`,
                [
                    uuidv4(),
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

            if (isPublic) {
                await this.updateIsPublic(client, orderId);
            }

            // Publish MQ
            const exchange = EXCHANGES.REVIEWS.name;
            const routingKey =
                reviewType === ReviewType.BUYER
                    ? ROUTING_KEYS.REVIEWS.SELLER_REVIEWED
                    : ROUTING_KEYS.REVIEWS.BUYER_REVIEWED;

            const notification: INotificationDocument = {
                recipient: {
                    id: targetId,
                    role: reviewType === ReviewType.BUYER ? 'seller' : 'buyer',
                    username: reviewerUsername,
                    avatar: reviewerPicture,
                },
                payload: {
                    message: `gave you a review.`,
                    extra: {orderId},
                },
                actor: {
                    id: reviewerId,
                    role: reviewType === ReviewType.BUYER ? 'buyer' : 'seller',
                    username: targetUsername,
                    avatar: targetPicture,
                },
                timestamp: createdAt.toISOString(),
            };

            const message: IReviewMessageQueue = {
                type:
                    reviewType === ReviewType.BUYER
                        ? MessageQueueType.SELLER_REVIEWED
                        : MessageQueueType.BUYER_REVIEWED,
                notification,
                reviewId: newReviews[0].id,
                orderId,
                gigId,
                reviewerId,
                targetId,
                review,
                rating,
                createdAt: createdAt.toISOString(),
            };

            await messageQueue.publish({
                channelName: publishChannel,
                exchange,
                routingKey,
                message: JSON.stringify(message),
            });

            AppLogger.info('Review details sent to order and users services', {
                operation: 'queue:publish',
            });

            return newReviews[0];
        });
    }

    /** ===================== UPDATE IS_PUBLIC ===================== */
    private async updateIsPublic(client: PoolClient, orderId: string): Promise<void> {
        await client.query(
            `UPDATE reviews
             SET is_public = true
             WHERE order_id = $1`,
            [orderId]
        );

        AppLogger.info('Updated reviews to is_public=true', {
            operation: 'reviews:update-public',
            metadata: {orderId},
        });
    }

    /** ===================== REPLY REVIEW ===================== */
    public async replyReview(data: ReplyReviewSchema): Promise<IReviewDocument> {
        return database.runTransaction(async (client) => {
            const {rows} = await client.query<IReviewDocument>(
                `UPDATE reviews
                 SET reply = $1
                 WHERE id = $2
                   AND review_type = $3
                 RETURNING *`,
                [data.reply, data.reviewId, ReviewType.SELLER]
            );

            if (rows.length === 0) {
                throw new NotFoundError({
                    clientMessage: 'Review not found.',
                    operation: 'reviews:reply-buyer',
                });
            }

            const review = this.mapRowToReview(rows[0]);

            const exchange = EXCHANGES.REVIEWS.name;
            const routingKey = ROUTING_KEYS.REVIEWS.SELLER_REPLIED;

            const notification: INotificationDocument = {
                recipient: {
                    id: review.targetId,
                    role: 'buyer',
                    username: review.reviewerUsername,
                    avatar: '',
                },
                payload: {
                    message: `replied to your review.`,
                    extra: {orderId: review.orderId},
                },
                actor: {
                    id: review.reviewerId,
                    role: 'seller',
                    username: review.targetUsername,
                    avatar: '',
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

            AppLogger.info('Seller reply sent to users services', {operation: 'queue:publish'});

            return review;
        });
    }

    /** ===================== QUERY REVIEWS ===================== */
    public async queryReviews(params: QueryReviewsSchema): Promise<IReviewDocument[]> {
        const {query, orderId, gigId, targetId, limit = 20, page = 1} = params;
        const userId = RequestContext.getUserId();

        const conditions: string[] = [];
        const values: (string | number)[] = [];
        let index = 1;

        if (userId) {
            conditions.push(`(reviewer_id = $${index++} OR is_public = true)`);
            values.push(userId);
        } else {
            conditions.push(`is_public = true`);
        }

        if (orderId) {
            conditions.push(`order_id = $${index++}`);
            values.push(orderId);
        }
        if (gigId) {
            conditions.push(`gig_id = $${index++}`);
            values.push(gigId);
        }
        if (targetId) {
            conditions.push(`target_id = $${index++}`);
            values.push(targetId);
        }
        if (query) {
            conditions.push(`(
            review ILIKE $${index} OR
            reviewer_username ILIKE $${index + 1} OR
            target_username ILIKE $${index + 2}
          )`);
            values.push(`%${query}%`, `%${query}%`, `%${query}%`);
            index += 3;
        }

        if (conditions.length === 0) return [];

        const offset = (page - 1) * limit;
        const sql = `
            SELECT *
            FROM reviews
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT $${index++} OFFSET $${index}
        `;
        values.push(limit, offset);

        const {rows} = await database.getPool().query<Record<string, unknown>>(sql, values);
        console.log(sql, rows)
        return rows.map(this.mapRowToReview.bind(this));
    }

    /** ===================== HELPER ===================== */
    private mapRowToReview(row: Record<string, unknown>): IReviewDocument {
        return Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
                this.objKeys[key] || key,
                value,
            ])
        ) as IReviewDocument;
    }
}

export const reviewService = new ReviewService();
