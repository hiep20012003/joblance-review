import { createVerifyGatewayRequest } from '@hiep20012003/joblance-shared';
import { Application } from 'express';
import { config } from '@reviews/config';
import { initialContextMiddleware } from '@reviews/middlewares/context.middleware';

import { reviewRoutes } from './review.routes';
import { healthRoutes } from './health.route';
import seedRoutes from './seed.route';

const BASE_PATH = '/api/v1';

const appRoutes = (app: Application): void => {
  app.use('', healthRoutes.routes());
  app.use('/seed', seedRoutes);
  app.use(createVerifyGatewayRequest(`${config.GATEWAY_SECRET_KEY}`), initialContextMiddleware);
  app.use(BASE_PATH, reviewRoutes.routes());
};

export { appRoutes };