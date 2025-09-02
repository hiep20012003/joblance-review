import { winstonLogger } from '@hiep20012003/joblance-shared';
import { Logger } from 'winston';
import { config } from '@review/config';
import { Pool, PoolClient } from 'pg';

export class Database {
  private pool: Pool;
  private log: Logger;

  constructor() {
    this.log = winstonLogger(`${config.ELASTIC_SEARCH_URL}`, 'reviewDatabaseServer', 'debug');
    this.pool = new Pool({
      host: config.DATABASE_HOST,
      user: config.DATABASE_USER,
      password: config.DATABASE_PASSWORD,
      port: 5432,
      database: config.DATABASE_NAME,
      ...(config.NODE_ENV !== 'development' && config.CLUSTER_TYPE === 'AWS' && {
        ssl: {
          rejectUnauthorized: false
        }
      })
    });

    this.pool.on('error', (error: Error) => {
      this.log.log('error', 'pg client error', error);
      process.exit(-1);
    });
  }

  /**
   * Khởi tạo bảng và index nếu chưa có
   */
  private async init(): Promise<void> {
    const createTableText = `
      CREATE TABLE IF NOT EXISTS public.reviews (
        id SERIAL UNIQUE,
        gigId text NOT NULL,
        reviewerId text NOT NULL,
        orderId text NOT NULL,
        sellerId text NOT NULL,
        review text NOT NULL,
        reviewerImage text NOT NULL,
        reviewerUsername text NOT NULL,
        country text NOT NULL,
        reviewType text NOT NULL,
        rating integer DEFAULT 0 NOT NULL,
        createdAt timestamp DEFAULT CURRENT_DATE,
        PRIMARY KEY (id)
      );

      CREATE INDEX IF NOT EXISTS gigId_idx ON public.reviews (gigId);
      CREATE INDEX IF NOT EXISTS sellerId_idx ON public.reviews (sellerId);
    `;

    await this.pool.query(createTableText);
    this.log.info('Review table ensured in PostgreSQL database.');
  }

  /**
   * Kết nối tới database và khởi tạo schema
   */
  public async connect(): Promise<void> {
    try {
      const client: PoolClient = await this.pool.connect();
      this.log.info('Review service successfully connected to PostgreSQL database.');
      client.release();
      await this.init();
    } catch (error) {
      this.log.error('ReviewService - Unable to connect to database');
      this.log.log('error', 'ReviewService connect() method error:', error);
    }
  }

  /**
   * Đóng kết nối database
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.log.info('Database connection closed.');
    } catch (error) {
      this.log.error('Error while closing database connection:', error);
    }
  }

  /**
   * Lấy pool để query từ nơi khác
   */
  public getPool(): Pool {
    return this.pool;
  }
}

export const database = new Database();
