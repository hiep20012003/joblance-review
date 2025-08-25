import express, { Express } from 'express';
import { ReviewServer } from '@review/server';
import { AppLogger } from '@review/utils/logger';

import { database } from './db/database';

class Application {
  private app: Express;
  private server: ReviewServer;

  constructor() {
    this.app = express();
    this.server = new ReviewServer(this.app);
  }

  public async initialize(): Promise<void> {
    const operation = 'app:init';

    try {
      await database.connect();
      await this.server.start();
      AppLogger.info('Review Service initialized', { operation });
    } catch (error) {
      AppLogger.error('', { operation, error });
      process.exit(1);
    }
  }
}

async function bootstrap(): Promise<void> {
  const application = new Application();
  await application.initialize();
}


// ---- Global error handlers ---- //
process.on('uncaughtException', (error) => {
  AppLogger.error('', { operation: 'app:uncaught-exception', error });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  AppLogger.error('', { operation: 'app:unhandled-rejection', error: reason });
  process.exit(1);
});

// ---- App Entry Point ---- //
bootstrap().catch((error) => {
  AppLogger.error('', { operation: 'app:bootstrap-failed', error });
  process.exit(1);
});
