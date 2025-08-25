import { Application } from 'express';

import { healthRoutes } from './health.route';

export const appRoutes = (app: Application) => {
  app.use('', healthRoutes.routes());
};
