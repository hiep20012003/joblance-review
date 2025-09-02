import { database } from '@review/db/database';
import { messageQueue, publishChannel } from '@review/queues/connection';
import { IReviewDocument, IReviewerObjectKeys, IReviewMessageDetails } from '@review/types/review';
import { ExchangeType } from '@hiep20012003/joblance-shared';
import { QueryResult } from 'pg';
import { AppLogger } from '@review/utils/logger';

export class ReviewService {
  private objKeys: IReviewerObjectKeys = {
    review: 'review',
    rating: 'rating',
    country: 'country',
    gigid: 'gigId',
    reviewerid: 'reviewerId',
    createdat: 'createdAt',
    orderid: 'orderId',
    sellerid: 'sellerId',
    reviewerimage: 'reviewerImage',
    reviewerusername: 'reviewerUsername',
    reviewtype: 'reviewType'
  };

  /**
   * Thêm một review mới
   * @param data Thông tin review
   * @returns IReviewDocument
   */
  public async addReview(data: IReviewDocument): Promise<IReviewDocument> {
    const {
      gigId,
      reviewerId,
      reviewerImage,
      sellerId,
      review,
      rating,
      orderId,
      reviewType,
      reviewerUsername,
      country
    } = data;

    const createdAtDate = new Date();

    const { rows } = await database.getPool().query<IReviewDocument>(
      `INSERT INTO reviews(gigId, reviewerId, reviewerImage, sellerId, review, rating, orderId, reviewType, reviewerUsername, country, createdAt)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [gigId, reviewerId, reviewerImage, sellerId, review, rating, orderId, reviewType, reviewerUsername, country, createdAtDate]
    );

    const messageDetails: IReviewMessageDetails = {
      gigId,
      reviewerId,
      sellerId,
      review,
      rating,
      orderId,
      createdAt: createdAtDate.toISOString(),
      type: reviewType as string
    };
    await messageQueue.publish(publishChannel, 'jobber-review', '', JSON.stringify(messageDetails), ExchangeType.Fanout);

    AppLogger.info('Review details sent to order and users services', { operation: 'queue:publish' });

    const result: IReviewDocument = Object.fromEntries(
      Object.entries(rows[0]).map(
        ([key, value]) => [this.objKeys[key as keyof IReviewerObjectKeys] || key, value]
      )
    ) as IReviewDocument;

    return result;
  }

  /**
   * Lấy danh sách review theo gigId
   * @param gigId ID của gig
   * @returns Danh sách review
   */
  public async getReviewsByGigId(gigId: string): Promise<IReviewDocument[]> {
    const reviews = await database
      .getPool()
      .query<Record<string, unknown>>(
        'SELECT * FROM reviews WHERE reviews.gigId = $1',
        [gigId]
      );

    return reviews.rows.map((row) => {
      const result: IReviewDocument = Object.fromEntries(
        Object.entries(row).map(
          ([key, value]) => [this.objKeys[key as keyof IReviewerObjectKeys] || key, value]
        )
      ) as IReviewDocument;

      return result;
    });
  }

  /**
   * Lấy danh sách review theo sellerId (chỉ các review type = seller-review)
   * @param sellerId ID của seller
   * @returns Danh sách review
   */
  public async getReviewsBySellerId(sellerId: string): Promise<IReviewDocument[]> {
    const reviews: QueryResult<Record<string, unknown>> = await database.getPool().query<Record<string, unknown>>(
      'SELECT * FROM reviews WHERE reviews.sellerId = $1 AND reviews.reviewType = $2',
      [sellerId, 'seller-review']
    );
    return reviews.rows.map((row) => {
      const result: IReviewDocument = Object.fromEntries(
        Object.entries(row).map(
          ([key, value]) => [this.objKeys[key as keyof IReviewerObjectKeys] || key, value]
        )
      ) as IReviewDocument;

      return result;
    });
  }
}

export const reviewService: ReviewService = new ReviewService();