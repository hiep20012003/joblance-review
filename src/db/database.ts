import { config } from '@review/config';
import { Pool, PoolClient } from 'pg';
import { AppLogger } from '@review/utils/logger';
import { ServerError } from '@hiep20012003/joblance-shared';

export class Database {
  private pool: Pool;

  constructor() {
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
      throw new ServerError({
        clientMessage: 'Unexpected database error',
        cause: error,
        operation: 'database:pool_error'
      });
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
    AppLogger.info('Review table and indexes ensured in PostgreSQL database.', { operation: 'database:init' });
  }

  /**
   * Kết nối tới database và khởi tạo schema
   */
  public async connect(): Promise<void> {
    try {
      const client: PoolClient = await this.pool.connect();
      AppLogger.info('Successfully connected to PostgreSQL database.', { operation: 'database:connect' });
      client.release();
      await this.init();
    } catch (error) {
      throw new ServerError({
        clientMessage: 'Unable to connect to database',
        cause: error,
        operation: 'database:connect_error'
      });
    }
  }

  /**
   * Đóng kết nối database
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      AppLogger.info('PostgreSQL database connection closed.', { operation: 'database:close' });
    } catch (error) {
      throw new ServerError({
        clientMessage: 'Error while closing database connection',
        cause: error,
        operation: 'database:close_error'
      });
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
