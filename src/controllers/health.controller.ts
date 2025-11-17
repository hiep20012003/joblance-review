import {Request, Response} from 'express';
import {StatusCodes, ReasonPhrases} from 'http-status-codes';
import {SuccessResponse} from '@hiep20012003/joblance-shared';

class HealthController {
    public health = (_req: Request, res: Response): void => {
        new SuccessResponse({
            message: 'User created successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
        }).send(res);
    };
}

export const healthController = new HealthController();
