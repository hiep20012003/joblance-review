import path from 'path';

import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(
    process.cwd(),
    `.env.${process.env.NODE_ENV || 'development'}`
  ),
});

class Config {
  // Application
  public NODE_ENV: string = process.env.NODE_ENV || 'development';
  public PORT: number = parseInt(process.env.PORT || '4008', 10);

  // Gateway
  public API_GATEWAY_URL: string = process.env.API_GATEWAY_URL || 'http://localhost:4000';

  // Database
  public DATABASE_URL: string =
    process.env.DATABASE_URL ||
    'postgresql://joblance:joblance@localhost:5432/joblance_reviews';

  // Redis
  public REDIS_URL: string = process.env.REDIS_URL || 'redis://localhost:6379';

  // Messaging / RabbitMQ
  public RABBITMQ_URL: string =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  // Gateway secret for internal JWT
  public GATEWAY_SECRET_KEY: string = process.env.GATEWAY_SECRET_KEY || '';

  // APM
  public ENABLE_APM: boolean = process.env.ENABLE_APM === '1';
  public ELASTIC_APM_SERVER_URL: string = process.env.ELASTIC_APM_SERVER_URL || '';
  public ELASTIC_APM_SECRET_TOKEN: string = process.env.ELASTIC_APM_SECRET_TOKEN || '';
}

export const config = new Config();
