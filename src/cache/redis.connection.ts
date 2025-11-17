
import { config } from '@reviews/config';
import { AppLogger } from '@reviews/utils/logger';
import { RedisClient } from '@hiep20012003/joblance-shared';

export class CacheStore extends RedisClient {

}

export const cacheStore = new CacheStore(`${config.REDIS_URL}`, AppLogger);
