import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express 4 does not catch rejected promises from async route handlers -
 * an unhandled rejection there crashes the whole process, not just that
 * request. Wrap every async handler with this so errors reach the error
 * middleware instead.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
