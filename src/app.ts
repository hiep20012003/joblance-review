import '@elastic/opentelemetry-node';
import express, {Express} from 'express';
import {ReviewsServer} from '@reviews/server';
import {AppLogger} from '@reviews/utils/logger';

class Application {
    private app: Express;
    private server: ReviewsServer;

    constructor() {
        this.app = express();
        this.server = new ReviewsServer(this.app);
    }

    public async initialize(): Promise<void> {
        const operation = 'app:init';

        try {
            await this.server.start();
            AppLogger.info('Review Service initialized', {operation});
        } catch (error) {
            AppLogger.error('', {operation, error});
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
    AppLogger.error('', {operation: 'app:uncaught-exception', error});
    // process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    AppLogger.error('', {operation: 'app:unhandled-rejection', error: reason});
    // process.exit(1);
});

// ---- App Entry Point ---- //
bootstrap().catch((error) => {
    AppLogger.error('', {operation: 'app:bootstrap-failed', error});
    // process.exit(1);
});
