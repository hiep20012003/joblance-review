import { config } from '@reviews/config';
import { AppLogger } from '@reviews/utils/logger';
import { MessageQueue, setupAllQueues } from '@hiep20012003/joblance-shared';

export const messageQueue = MessageQueue.getInstance(`${config.RABBITMQ_URL}`);
export const publishChannel: string = 'review-publish-channel';
export const consumerChannel: string = 'review-consumer-channel';

export async function initQueue() {
  await messageQueue.connect();
  AppLogger.info('RabbitMQ connection established successfully', { operation: 'queue:connect' });
  await setupAllQueues(messageQueue, (error: Error, queueName?: string) => {
    AppLogger.error(
      `[Setup] Failed to setup queue${queueName ? ` "${queueName}"` : ''}`,
      {
        operation: 'queue:setup-all',
        error: error,
      }
    );
  });
}
