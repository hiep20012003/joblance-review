import {config} from '@reviews/config';
import {Pool, PoolClient} from 'pg';
import {AppLogger} from '@reviews/utils/logger';
import {ServerError} from '@hiep20012003/joblance-shared';

export class Database {
    private readonly pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: `${config.DATABASE_URL}`,
        });

        this.pool.on('error', (error: Error) => {
            throw new ServerError({
                clientMessage: 'Unexpected database error',
                cause: error,
                operation: 'database:pool_error',
            });
        });
    }

    private async init(): Promise<void> {
        const createTableText = `
            CREATE TABLE IF NOT EXISTS public.reviews
            (
                id                text UNIQUE,
                gig_id            text                    NOT NULL,
                order_id          text                    NOT NULL,
                target_id         text                    NOT NULL,
                target_username   text                    NOT NULL,
                target_picture    text,
                reviewer_id       text                    NOT NULL,
                reviewer_username text                    NOT NULL,
                reviewer_picture  text,
                review            text                    NOT NULL,
                review_type       text                    NOT NULL,
                reply             text,
                rating            integer   DEFAULT 0     NOT NULL,
                is_public         boolean   DEFAULT false NOT NULL,
                is_seeded         boolean   DEFAULT false NOT NULL,
                created_at        timestamp DEFAULT CURRENT_DATE,
                PRIMARY KEY (id)
            );

            CREATE INDEX IF NOT EXISTS gigId_idx ON public.reviews (gig_id);
            CREATE INDEX IF NOT EXISTS targetId_idx ON public.reviews (target_id);
            CREATE INDEX IF NOT EXISTS reviewerId_idx ON public.reviews (reviewer_id);
            CREATE INDEX IF NOT EXISTS reviewerUsername_idx ON public.reviews (reviewer_username);
            CREATE INDEX IF NOT EXISTS targetUsername_idx ON public.reviews (target_username);
        `;

        await this.pool.query(createTableText);
        AppLogger.info('Review table and indexes ensured in PostgreSQL database.', {operation: 'database:init'});
    }

    public async connect(): Promise<void> {
        try {
            const client: PoolClient = await this.pool.connect();
            AppLogger.info('Successfully connected to PostgreSQL database.', {operation: 'database:connect'});
            client.release();
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
            AppLogger.info('PostgreSQL database connection closed.', {operation: 'database:close'});
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

    public async runTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

export const database = new Database();
