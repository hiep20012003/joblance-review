import { config } from '@review/config';
import { AppLogger } from '@review/utils/logger';
import { MessageQueue } from '@hiep20012003/joblance-shared';

export const messageQueue = MessageQueue.getInstance(`${config.RABBITMQ_ENDPOINT}`);
export const publishChannel: string = 'review-publish-channel';
export const consumerChannel: string = 'review-consumer-channel';

export async function initQueue() {
  await messageQueue.connect();
  AppLogger.info('RabbitMQ connection established successfully', { operation: 'queue:connect' });
}
