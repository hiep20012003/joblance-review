import { createVerifyGatewayRequest } from '@hiep20012003/joblance-shared';
import { Application } from 'express';

import { reviewRoutes } from './review.routes';
import { healthRoutes } from './health.route';

const BASE_PATH = '/api/v1/review';

const appRoutes = (app: Application): void => {
  app.use('', healthRoutes.routes());
  app.use(BASE_PATH, createVerifyGatewayRequest, reviewRoutes);
};

export { appRoutes };