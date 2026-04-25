import { track } from "../core/tracker.js";
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
export function patchAxios(axiosInstance, options = {}) {
    axiosInstance.interceptors.response.use((response) => {
        try {
            const url = response.config?.url ?? "";
            const baseURL = response.config?.baseURL ?? "";
            let fullUrl = url;
            if (baseURL && !url.startsWith("http")) {
                fullUrl = baseURL.endsWith("/") ? baseURL + url : baseURL + "/" + url;
            }
            if (options.filter && !options.filter(fullUrl)) {
                return response;
            }
            const contentType = response.headers?.["content-type"] ?? response.headers?.["Content-Type"] ?? "";
            if (contentType.includes("application/json") && response.data) {
                track(fullUrl, response.data, options);
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