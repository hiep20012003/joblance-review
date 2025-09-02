import { database } from '@review/db/database';
import { messageQueue, publishChannel } from '@review/queues/connection';
import { IReviewDocument, IReviewerObjectKeys, IReviewMessage, ExchangeType, MessageQueueType } from '@hiep20012003/joblance-shared';
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

    const message: IReviewMessage = {
      gigId,
      reviewerId,
      sellerId,
      review,
      rating,
      orderId,
      createdAt: createdAtDate.toISOString(),
      type: reviewType as MessageQueueType
    };
    await messageQueue.publish(publishChannel, 'jobber-review', '', JSON.stringify(message), ExchangeType.Fanout);

    AppLogger.info('Review details sent to order and users services', { operation: 'queue:publish' });

    const result: IReviewDocument = Object.fromEntries(
      Object.entries(rows[0]).map(
        ([key, value]) => [this.objKeys[key as keyof IReviewerObjectKeys] || key, value]
      )
    ) as IReviewDocument;

    return result;
  }

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

  public async getReviewsBySellerId(sellerId: string): Promise<IReviewDocument[]> {
    const reviews = await database.getPool().query<Record<string, unknown>>(
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