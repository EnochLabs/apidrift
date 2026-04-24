"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchAxios = patchAxios;
const tracker_js_1 = require("../core/tracker.js");
/**
 * Attach apidrift to an axios instance.
 *
 * Usage:
 *   import axios from 'axios'
 *   import { patchAxios } from 'apidrift/interceptors/axios'
 *   patchAxios(axios)
 *
 * Also works with axios instances:
 *   const api = axios.create({ baseURL: '...' })
 *   patchAxios(api)
 */
function patchAxios(axiosInstance, options = {}) {
    axiosInstance.interceptors.response.use((response) => {
        try {
            const url = response.config?.url ?? "";
            const baseURL = response.config?.baseURL ?? "";
            const fullUrl = url.startsWith("http") ? url : baseURL + url;
            if (options.filter && !options.filter(fullUrl)) {
                return response;
            }
            const contentType = response.headers?.["content-type"] ??
                response.headers?.["Content-Type"] ??
                "";
            if (contentType.includes("application/json") && response.data) {
                (0, tracker_js_1.track)(fullUrl, response.data, options);
            }
        }
        catch {
            // Never crash — apidrift is an observer
        }
        return response;
    }, (error) => {
        // Don't track error responses
        return Promise.reject(error);
    });
}
//# sourceMappingURL=axios.js.map