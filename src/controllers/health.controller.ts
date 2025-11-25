import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

class HealthController {
  public health = (_req: Request, res: Response): void => {
    res.status(StatusCodes.OK).send('Review Service is healthy and OK');
  };
}

export const healthController = new HealthController();
