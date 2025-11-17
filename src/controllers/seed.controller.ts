// src/controllers/seedReviews.controller.ts
import {Request, Response} from 'express';
import {ReviewType} from '@hiep20012003/joblance-shared';
import {AppLogger} from '@reviews/utils/logger';
import {database} from '@reviews/database/connection';

export const seedReviews = async (req: Request, res: Response) => {
    const operation = 'seedReviews';

    const {completedOrders} = req.body as {
        completedOrders: Array<{
            _id: string;
            gigId: string;
            buyerId: string;
            buyerUsername: string;
            buyerPicture?: string;
            sellerId: string;
            sellerUsername: string;
            sellerPicture?: string;
            buyerReview?: { _id: string; rating: number; review: string; timestamp: string };
            sellerReview?: { _id: string; rating: number; review: string; timestamp: string };
        }>;
    };

    if (!Array.isArray(completedOrders) || completedOrders.length === 0) {
        return res.status(400).json({
            message: 'Invalid payload: "completedOrders" must be a non-empty array',
        });
    }

    AppLogger.info(`Seeding ${completedOrders.length} orders → reviews (using original _id + timestamp)`, {operation});

    const client = await database.getPool().connect();
    try {
        await client.query('BEGIN');

        const insertQueries: Promise<any>[] = [];

        for (const order of completedOrders) {
            const {
                _id: orderId,
                gigId,
                buyerId,
                buyerUsername,
                buyerPicture,
                sellerId,
                sellerUsername,
                sellerPicture,
                buyerReview,
                sellerReview,
            } = order;

            // === BUYER REVIEW ===
            if (buyerReview) {
                insertQueries.push(
                    client.query(
                        `INSERT INTO reviews(id, gig_id, order_id,
                                             reviewer_id, reviewer_username, reviewer_picture,
                                             target_id, target_username, target_picture,
                                             review, rating, review_type, reply, is_public, created_at, is_seeded)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            buyerReview._id,                    // ← DÙNG NGUYÊN _id
                            gigId,
                            orderId,
                            buyerId,
                            buyerUsername,
                            buyerPicture || null,
                            sellerId,
                            sellerUsername,
                            sellerPicture || null,
                            buyerReview.review,
                            buyerReview.rating,
                            ReviewType.BUYER,
                            null,
                            false,
                            buyerReview.timestamp,              // ← DÙNG NGUYÊN timestamp
                            true,
                        ]
                    )
                );
            }

            // === SELLER REVIEW ===
            if (sellerReview) {
                insertQueries.push(
                    client.query(
                        `INSERT INTO reviews(id, gig_id, order_id,
                                             reviewer_id, reviewer_username, reviewer_picture,
                                             target_id, target_username, target_picture,
                                             review, rating, review_type, reply, is_public, created_at, is_seeded)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            sellerReview._id,
                            gigId,
                            orderId,
                            sellerId,
                            sellerUsername,
                            sellerPicture || null,
                            buyerId,
                            buyerUsername,
                            buyerPicture || null,
                            sellerReview.review,
                            sellerReview.rating,
                            ReviewType.SELLER,
                            null,
                            false,
                            sellerReview.timestamp,
                            true,
                        ]
                    )
                );
            }
        }

        await Promise.all(insertQueries);

        // === CẬP NHẬT is_public = true CHO ORDER CÓ CẢ 2 REVIEW ===
        const orderIdsWithBoth = completedOrders
            .filter(o => o.buyerReview && o.sellerReview)
            .map(o => o._id);

        if (orderIdsWithBoth.length > 0) {
            const placeholders = orderIdsWithBoth.map((_, i) => `$${i + 1}`).join(', ');
            await client.query(
                `UPDATE reviews
                 SET is_public = true
                 WHERE order_id IN (${placeholders})
                   AND is_seeded = true`,
                orderIdsWithBoth
            );
        }

        await client.query('COMMIT');

        const totalReviews = completedOrders.reduce((sum, o) => {
            return sum + (o.buyerReview ? 1 : 0) + (o.sellerReview ? 1 : 0);
        }, 0);

        AppLogger.info(`Seeded ${totalReviews} reviews with original _id + timestamp`, {operation});

        return res.status(201).json({
            message: 'Reviews seeded successfully (original _id + timestamp preserved)',
            stats: {
                totalOrders: completedOrders.length,
                totalReviewsSeeded: totalReviews,
                ordersWithBothReviews: orderIdsWithBoth.length,
            },
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        AppLogger.error('Seed reviews failed', {operation, error: error.message});
        return res.status(500).json({message: 'Seed failed', error: error.message});
    } finally {
        client.release();
    }
};

// XÓA TẤT CẢ REVIEW ĐÃ SEED – KHÔNG CẦN INPUT
export const deleteSeededReviews = async (_req: Request, res: Response) => {
    const operation = 'deleteSeededReviews';

    try {
        const {rowCount} = await database.getPool().query(`
            DELETE
            FROM reviews
            WHERE is_seeded = true
        `);

        AppLogger.info(`Deleted ${rowCount} seeded reviews (is_seeded = true)`, {operation});

        return res.status(200).json({
            message: 'All seeded reviews deleted successfully',
            deletedCount: rowCount,
        });
    } catch (error: any) {
        AppLogger.error('Delete seeded reviews failed', {operation, error: error.message});
        return res.status(500).json({message: 'Delete failed', error: error.message});
    }
};