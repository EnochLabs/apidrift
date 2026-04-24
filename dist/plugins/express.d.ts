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
import type { DriftResult } from "../core/diff.js";
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
export declare function apiDriftMiddleware(options?: ExpressMiddlewareOptions): Middleware;
/**
 * Convenience wrapper: track a specific route handler's response.
 *
 * @example
 * app.get('/api/user', trackRoute(async (req, res) => {
 *   res.json(await db.getUser())
 * }))
 */
export declare function trackRoute(handler: (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void, options?: ExpressMiddlewareOptions): Middleware;
export {};
//# sourceMappingURL=express.d.ts.map