import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENVIRONMENT || 'dev'}` });

class Config {
  public GATEWAY_JWT_TOKEN: string;
  public PORT: string;
  public JWT_TOKEN: string;
  public NODE_ENV: string;
  public API_GATEWAY_URL: string;
  public CLIENT_URL: string;
  public ELASTIC_SEARCH_URL: string;

  constructor() {
    this.GATEWAY_JWT_TOKEN = process.env.GATEWAY_JWT_TOKEN || '';
    this.PORT = process.env.PORT || '';
    this.JWT_TOKEN = process.env.JWT_TOKEN || '';
    this.NODE_ENV = process.env.NODE_ENV || '';
    this.API_GATEWAY_URL = process.env.API_GATEWAY_URL || '';
    this.CLIENT_URL = process.env.CLIENT_URL || '';
    this.ELASTIC_SEARCH_URL = process.env.ELASTIC_SEARCH_URL || '';
  }
}

export const config: Config = new Config();
