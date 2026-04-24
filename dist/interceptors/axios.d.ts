import { TrackOptions } from "../core/tracker.js";
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
export declare function patchAxios(axiosInstance: AxiosLike, options?: AxiosInterceptOptions): void;
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
            use: (onFulfilled: (response: AxiosResponse) => AxiosResponse, onRejected: (error: unknown) => Promise<never>) => void;
        };
    };
}
export {};
//# sourceMappingURL=axios.d.ts.map