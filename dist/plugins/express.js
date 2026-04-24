"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiDriftMiddleware = apiDriftMiddleware;
exports.trackRoute = trackRoute;
const tracker_js_1 = require("../core/tracker.js");
/**
 * Express middleware that intercepts outgoing JSON responses and tracks drift.
 */
function apiDriftMiddleware(options = {}) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function patchedJson(body) {
            try {
                const routePath = req.baseUrl + req.path;
                if (!options.filter || options.filter(routePath)) {
                    const trackOpts = {
                        silent: options.silent,
                        onDrift: options.onDrift
                            ? (result) => options.onDrift(result, req)
                            : undefined,
                    };
                    (0, tracker_js_1.track)(routePath, body, trackOpts);
                }
            }
            catch {
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
function trackRoute(handler, options = {}) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function patchedJson(body) {
            try {
                const trackOpts = {
                    silent: options.silent,
                    onDrift: options.onDrift
                        ? (result) => options.onDrift(result, req)
                        : undefined,
                };
                (0, tracker_js_1.track)(req.baseUrl + req.path, body, trackOpts);
            }
            catch { /* never crash */ }
            return originalJson(body);
        };
        handler(req, res, next);
    };
}
//# sourceMappingURL=express.js.map