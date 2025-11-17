// src/controllers/seedReviews.controller.ts
import { Request, Response } from 'express';
import { ReviewType } from '@hiep20012003/joblance-shared';
import { AppLogger } from '@reviews/utils/logger';
import { database } from '@reviews/database/connection';
import { reviewService } from '@reviews/services/review.service';

export const seedReviews = async (req: Request, res: Response) => {
  const operation = 'seedReviews';

  const { completedOrders } = req.body as {
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

  AppLogger.info(`Seeding ${completedOrders.length} orders → reviews`, { operation });

  const client = await database.getPool().connect();

  try {
    await client.query('BEGIN');

    const insertQueries: Promise<any>[] = [];
    const ordersWithBothReviews: string[] = [];

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

      let hasBuyer = false;
      let hasSeller = false;

      // === BUYER REVIEW ===
      if (buyerReview) {
        hasBuyer = true;
        insertQueries.push(
          client.query(
            `INSERT INTO reviews(
              id, gig_id, order_id,
              reviewer_id, reviewer_username, reviewer_picture,
              target_id, target_username, target_picture,
              review, rating, review_type, reply, is_public, created_at, is_seeded
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (id) DO NOTHING`,
            [
              buyerReview._id,
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
              ReviewType.SELLER,
              null,
              false, // tạm để false
              buyerReview.timestamp,
              true,
            ]
          )
        );
      }

      // === SELLER REVIEW ===
      if (sellerReview) {
        hasSeller = true;
        insertQueries.push(
          client.query(
            `INSERT INTO reviews(
              id, gig_id, order_id,
              reviewer_id, reviewer_username, reviewer_picture,
              target_id, target_username, target_picture,
              review, rating, review_type, reply, is_public, created_at, is_seeded
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
              ReviewType.BUYER,
              null,
              false,
              sellerReview.timestamp,
              true,
            ]
          )
        );
      }

      // Nếu có cả 2 → đánh dấu để xử lý sau
      if (hasBuyer && hasSeller) {
        ordersWithBothReviews.push(orderId);
      }
    }

    // Chờ tất cả insert xong
    await Promise.all(insertQueries);

    // === XỬ LÝ CÁC ORDER CÓ CẢ 2 REVIEW: PUBLIC + PUBLISH ===
    for (const orderId of ordersWithBothReviews) {
      const { rows } = await client.query(
        `SELECT * FROM reviews WHERE order_id = $1 AND is_seeded = true ORDER BY created_at`,
        [orderId]
      );

      if (rows.length === 2) {
        await (reviewService as any).makeReviewsPublicAndPublish(client, orderId, rows);
      }
    }

    await client.query('COMMIT');

    const totalReviews = completedOrders.reduce((sum, o) => {
      return sum + (o.buyerReview ? 1 : 0) + (o.sellerReview ? 1 : 0);
    }, 0);

    AppLogger.info(`Seeded ${totalReviews} reviews successfully`, {
      operation,
    });

    return res.status(201).json({
      message: 'Reviews seeded successfully',
      stats: {
        totalOrders: completedOrders.length,
        totalReviewsSeeded: totalReviews,
        ordersWithBothReviews: ordersWithBothReviews.length,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    AppLogger.error('Seed reviews failed', { operation, error: error.message });
    return res.status(500).json({ message: 'Seed failed', error: error.message });
  } finally {
    client.release();
  }
};

// XÓA TẤT CẢ REVIEW ĐÃ SEED
export const deleteSeededReviews = async (_req: Request, res: Response) => {
  const operation = 'deleteSeededReviews';

  try {
    const { rowCount } = await database.getPool().query(`
            DELETE FROM reviews WHERE is_seeded = true
        `);

    AppLogger.info(`Deleted ${rowCount} seeded reviews`, { operation });

    return res.status(200).json({
      message: 'All seeded reviews deleted',
      deletedCount: rowCount,
    });
  } catch (error: any) {
    AppLogger.error('Delete failed', { operation, error: error.message });
    return res.status(500).json({ message: 'Delete failed', error: error.message });
  }
};