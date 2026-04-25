/**
 * apidrift/express
 *
 * Express middleware that tracks outgoing API responses for drift.
 *
 * @example
 * import express from 'express'
 * import { apiDriftMiddleware } from 'apidrift/express'
 *
 * const app = express()
 * app.use(apiDriftMiddleware())
 */

import { track } from "../core/tracker.js";
import type { DriftResult } from "../core/diff.js";
import type { TrackOptions } from "../core/tracker.js";

// Minimal Express types — no hard dep on @types/express
interface ExpressRequest {
  path: string;
  method: string;
  baseUrl: string;
  url: string;
}
interface ExpressResponse {
  json: (body: unknown) => ExpressResponse;
  send: (body: unknown) => ExpressResponse;
  statusCode: number;
  locals: Record<string, unknown>;
}
type NextFunction = () => void;
type Middleware = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void;

export interface ExpressMiddlewareOptions {
  /** Only track routes matching this predicate */
  filter?: (path: string) => boolean;
  /** Suppress console output */
  silent?: boolean;
  /** Called when drift is detected — receives both result and originating request */
  onDrift?: (result: DriftResult, req: ExpressRequest) => void;
}

/**
 * Express middleware that intercepts outgoing JSON responses and tracks drift.
 */
export function apiDriftMiddleware(options: ExpressMiddlewareOptions = {}): Middleware {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function patchedJson(body: unknown): ExpressResponse {
      try {
        const routePath = req.baseUrl + req.path;
        if (!options.filter || options.filter(routePath)) {
          const trackOpts: TrackOptions = {
            silent: options.silent,
            onDrift: options.onDrift
              ? (result: DriftResult) => options.onDrift!(result, req)
              : undefined,
          };
          track(routePath, body, trackOpts);
        }
      } catch {
        // Never crash the server — apidrift is an observer
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Convenience wrapper: track a specific route handler's response.
 *
 * @example
 * app.get('/api/user', trackRoute(async (req, res) => {
 *   res.json(await db.getUser())
 * }))
 */
export function trackRoute(
  handler: (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void,
  options: ExpressMiddlewareOptions = {}
): Middleware {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function patchedJson(body: unknown): ExpressResponse {
      try {
        const trackOpts: TrackOptions = {
          silent: options.silent,
          onDrift: options.onDrift
            ? (result: DriftResult) => options.onDrift!(result, req)
            : undefined,
        };
        track(req.baseUrl + req.path, body, trackOpts);
      } catch {
        /* never crash */
      }
      return originalJson(body);
    };
    handler(req, res, next);
  };
}
