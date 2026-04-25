import { track, TrackOptions } from "../core/tracker.js";

export interface AxiosInterceptOptions extends TrackOptions {
  filter?: (url: string) => boolean;
}

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
export function patchAxios(axiosInstance: AxiosLike, options: AxiosInterceptOptions = {}): void {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      try {
        const url = response.config?.url ?? "";
        const baseURL = response.config?.baseURL ?? "";
        const fullUrl = url.startsWith("http") ? url : baseURL + url;

        if (options.filter && !options.filter(fullUrl)) {
          return response;
        }

        const contentType =
          response.headers?.["content-type"] ?? response.headers?.["Content-Type"] ?? "";

        if (contentType.includes("application/json") && response.data) {
          track(fullUrl, response.data, options);
        }
      } catch {
        // Never crash — apidrift is an observer
      }
      return response;
    },
    (error: unknown) => {
      // Don't track error responses
      return Promise.reject(error);
    }
  );
}

// Minimal axios type stubs so we don't require axios as a peer dep
interface AxiosResponse {
  data: unknown;
  status: number;
  headers: Record<string, string>;
  config: {
    url?: string;
    baseURL?: string;
  };
}

interface AxiosLike {
  interceptors: {
    response: {
      use: (
        onFulfilled: (response: AxiosResponse) => AxiosResponse,
        onRejected: (error: unknown) => Promise<never>
      ) => void;
    };
  };
}
