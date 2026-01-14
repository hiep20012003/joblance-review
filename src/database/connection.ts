import { config } from '@reviews/config';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { AppLogger } from '@reviews/utils/logger';
import { ServerError } from '@hiep20012003/joblance-shared';

export class Database {
  private readonly pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      uri: config.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+07:00',
      supportBigNumbers: true,
      bigNumberStrings: true,
      multipleStatements: true,
    });
  }

  private async init(): Promise<void> {
    const createTableSQL = `
            CREATE TABLE IF NOT EXISTS reviews (
                                                   id                VARCHAR(36) PRIMARY KEY,
                                                   gig_id            VARCHAR(36) NOT NULL,
                                                   order_id          VARCHAR(36) NOT NULL,
                                                   target_id         VARCHAR(36) NOT NULL,
                                                   target_username   VARCHAR(100) NOT NULL,
                                                   target_picture    TEXT,
                                                   reviewer_id       VARCHAR(36) NOT NULL,
                                                   reviewer_username VARCHAR(100) NOT NULL,
                                                   reviewer_picture  TEXT,
                                                   review            TEXT NOT NULL,
                                                   review_type       VARCHAR(50) NOT NULL,
                                                   reply             TEXT,
                                                   rating            INT DEFAULT 0 NOT NULL,
                                                   is_public         BOOLEAN DEFAULT FALSE NOT NULL,
                                                   is_seeded         BOOLEAN DEFAULT FALSE NOT NULL,
                                                   created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;

    const indexes = [
      { name: 'gigId_idx', column: 'gig_id' },
      { name: 'targetId_idx', column: 'target_id' },
      { name: 'reviewerId_idx', column: 'reviewer_id' },
      { name: 'reviewerUsername_idx', column: 'reviewer_username' },
      { name: 'targetUsername_idx', column: 'target_username' },
    ];

    const connection = await this.pool.getConnection();
    try {
      await connection.query(createTableSQL);
      for (const { name, column } of indexes) {
        try {
          await connection.query(`CREATE INDEX ${name} ON reviews (${column})`);
        } catch (err: any) {
          if (err.code !== 'ER_DUP_KEYNAME') throw err;
        }
      }
      AppLogger.info('Table "reviews" and indexes ensured in MySQL.', {
        operation: 'database:init',
      });
    } finally {
      connection.release();
    }
  }

  public async connect(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      AppLogger.info('Connected to MySQL database.', { operation: 'database:connect' });
      connection.release();
      await this.init();
    } catch (error) {
      throw new ServerError({
        clientMessage: 'Unable to connect to database',
        cause: error,
        operation: 'database:connect_error',
      });
    }
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
      AppLogger.info('MySQL database connection closed.', { operation: 'database:close' });
    } catch (error) {
      throw new ServerError({
        clientMessage: 'Error while closing database connection',
        cause: error,
        operation: 'database:close_error',
      });
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async runTransaction<T>(callback: (connection: PoolConnection)=> Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

export const database = new Database();
