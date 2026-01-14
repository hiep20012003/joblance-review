// src/controllers/seedReviews.controller.ts
import { Request, Response } from 'express';
import { ReviewType } from '@hiep20012003/joblance-shared';
import { AppLogger } from '@reviews/utils/logger';
import { database } from '@reviews/database/connection'; // giả sử export từ file Database
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

  try {
    const result = await database.runTransaction(async (connection) => {
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

        // === BUYER REVIEW (buyer review seller) ===
        if (buyerReview) {
          hasBuyer = true;
          insertQueries.push(
            connection.query(
              `INSERT INTO reviews(
                id, gig_id, order_id,
                reviewer_id, reviewer_username, reviewer_picture,
                target_id, target_username, target_picture,
                review, rating, review_type, reply, is_public, is_seeded
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE id = id`, // tránh lỗi duplicate (tương đương ON CONFLICT DO NOTHING)
              [
                buyerReview._id,
                gigId,
                orderId,
                buyerId, // reviewer = buyer
                buyerUsername,
                buyerPicture || null,
                sellerId, // target = seller
                sellerUsername,
                sellerPicture || null,
                buyerReview.review,
                buyerReview.rating,
                ReviewType.SELLER, // buyer đánh giá seller
                null, // reply
                false, // is_public
                true, // is_seeded
              ]
            )
          );
        }

        // === SELLER REVIEW (seller review buyer) ===
        if (sellerReview) {
          hasSeller = true;
          insertQueries.push(
            connection.query(
              `INSERT INTO reviews(
                id, gig_id, order_id,
                reviewer_id, reviewer_username, reviewer_picture,
                target_id, target_username, target_picture,
                review, rating, review_type, reply, is_public, is_seeded
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE id = id`,
              [
                sellerReview._id,
                gigId,
                orderId,
                sellerId, // reviewer = seller
                sellerUsername,
                sellerPicture || null,
                buyerId, // target = buyer
                buyerUsername,
                buyerPicture || null,
                sellerReview.review,
                sellerReview.rating,
                ReviewType.BUYER, // seller đánh giá buyer
                null,
                false,
                true,
              ]
            )
          );
        }

        if (hasBuyer && hasSeller) {
          ordersWithBothReviews.push(orderId);
        }
      }

      // Thực hiện tất cả insert
      await Promise.all(insertQueries);

      // Xử lý các order có cả 2 review: make public + publish event
      for (const orderId of ordersWithBothReviews) {
        const [rows] = await connection.query(
          `SELECT * FROM reviews WHERE order_id = ? AND is_seeded = true ORDER BY created_at`,
          [orderId]
        );

        if (Array.isArray(rows) && rows.length === 2) {
          // Giả sử makeReviewsPublicAndPublish đã được sửa để nhận connection
          await (reviewService as any).makeReviewsPublicAndPublish(connection, orderId, rows);
        }
      }

      return {
        totalReviews: completedOrders.reduce((sum, o) => {
          return sum + (o.buyerReview ? 1 : 0) + (o.sellerReview ? 1 : 0);
        }, 0),
        ordersWithBothReviews: ordersWithBothReviews.length,
      };
    });

    AppLogger.info(`Seeded ${result.totalReviews} reviews successfully`, { operation });

    return res.status(201).json({
      message: 'Reviews seeded successfully',
      stats: {
        totalOrders: completedOrders.length,
        totalReviewsSeeded: result.totalReviews,
        ordersWithBothReviews: result.ordersWithBothReviews,
      },
    });
  } catch (error: any) {
    AppLogger.error('Seed reviews failed', { operation, error: error });
    return res.status(500).json({ message: 'Seed failed', error: error.message });
  }
};

// XÓA TẤT CẢ REVIEW ĐÃ SEED (không cần transaction vì là delete bulk)
export const deleteSeededReviews = async (_req: Request, res: Response) => {
  const operation = 'deleteSeededReviews';

  try {
    const [result] = await database.getPool().query(
      `DELETE FROM reviews WHERE is_seeded = true`
    );

    const deletedCount = (result as any).affectedRows || 0;

    AppLogger.info(`Deleted ${deletedCount} seeded reviews`, { operation });

    return res.status(200).json({
      message: 'All seeded reviews deleted',
      deletedCount,
    });
  } catch (error: any) {
    AppLogger.error('Delete seeded reviews failed', { operation, error: error.message });
    return res.status(500).json({ message: 'Delete failed', error: error.message });
  }
};