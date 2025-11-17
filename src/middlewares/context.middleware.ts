// src/middleware/tokenContextMiddleware.ts

import {Request, Response, NextFunction} from 'express';
import {context} from '@reviews//utils/request-context';

export function initialContextMiddleware(req: Request, _res: Response, next: NextFunction) {
    const internalToken = typeof req.headers['x-internal-token'] === 'string' ? req.headers['x-internal-token'] : undefined;

    context.run({
        internalToken: internalToken,
        userId: req?.currentUser?.sub,
    }, () => {
        next();
    });
}