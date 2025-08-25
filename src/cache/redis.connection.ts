
import { config } from '@base/config';
import { AppLogger } from '@base/utils/logger';
import { RedisClient } from '@hiep20012003/joblance-shared';

export class CacheStore extends RedisClient {

}

export const cacheStore = new CacheStore(config.REDIS_HOST, AppLogger);
