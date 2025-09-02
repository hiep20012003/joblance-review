
import { config } from '@review/config';
import { AppLogger } from '@review/utils/logger';
import { RedisClient } from '@hiep20012003/joblance-shared';

export class CacheStore extends RedisClient {

}

export const cacheStore = new CacheStore(`${config.REDIS_HOST}`, AppLogger);
