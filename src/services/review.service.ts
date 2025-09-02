import { pool } from '@review/db/database';
import { publishFanoutMessage } from '@review/queues/review.producer';
import { reviewChannel } from '@review/server';
import { IReviewDocument, IReviewMessageDetails } from '@hiep20012003/joblance-shared';
import { map } from 'lodash';
import { QueryResult } from 'pg';

interface IReviewerObjectKeys {
  [key: string]: string | number | Date | undefined;
}

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

    const { rows } = await pool.query(
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
      createdAt: `${createdAtDate}`,
      type: `${reviewType}`
    };

    await publishFanoutMessage(
      reviewChannel,
      'jobber-review',
      JSON.stringify(messageDetails),
      'Review details sent to order and users services'
    );

    return this.mapRowToReview(rows[0]);
  }

  /**
   * Lấy danh sách review theo gigId
   * @param gigId ID của gig
   * @returns Danh sách review
   */
  public async getReviewsByGigId(gigId: string): Promise<IReviewDocument[]> {
    const reviews: QueryResult = await pool.query('SELECT * FROM reviews WHERE reviews.gigId = $1', [gigId]);
    return map(reviews.rows, (row) => this.mapRowToReview(row));
  }

  /**
   * Lấy danh sách review theo sellerId (chỉ các review type = seller-review)
   * @param sellerId ID của seller
   * @returns Danh sách review
   */
  public async getReviewsBySellerId(sellerId: string): Promise<IReviewDocument[]> {
    const reviews: QueryResult = await pool.query(
      'SELECT * FROM reviews WHERE reviews.sellerId = $1 AND reviews.reviewType = $2',
      [sellerId, 'seller-review']
    );
    return map(reviews.rows, (row) => this.mapRowToReview(row));
  }

  /**
   * Map dữ liệu từ DB sang định dạng chuẩn
   * @param row Dữ liệu từ DB
   * @returns IReviewDocument
   */
  private mapRowToReview(row: Record<string, any>): IReviewDocument {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [this.objKeys[key] || key, value])
    ) as IReviewDocument;
  }
}
