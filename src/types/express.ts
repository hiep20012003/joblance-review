export {};
declare global {
  namespace Express {
    interface Request {
      service: string;
      currentUser?: Record<string, unknown>;
      traceContext?: Record<string, unknown>;
    }
  }
}
