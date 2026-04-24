/**
 * Minimal ambient declarations — lets us compile without @types/node.
 * These exactly match the Node.js APIs we actually use.
 */

declare var process: NodeProcess;

interface NodeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  cwd(): string;
  exit(code?: number): never;
  stdout: {
    write(s: string): boolean;
    columns: number;
    rows: number;
    isTTY: boolean;
    on(event: "resize", listener: () => void): void;
  };
  stdin: {
    setRawMode?(mode: boolean): void;
    resume(): void;
    pause(): void;
    setEncoding(enc: string): void;
    on(event: "data", listener: (data: string) => void): void;
  };
  on(event: "SIGINT" | "SIGTERM" | string, listener: (...args: unknown[]) => void): void;
}

declare module "fs" {
  function existsSync(path: string): boolean;
  function readFileSync(path: string, encoding: "utf-8" | string): string;
  function writeFileSync(path: string, data: string, encoding: "utf-8" | string): void;
  function appendFileSync(path: string, data: string): void;
  function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module "path" {
  function join(...segments: string[]): string;
  function dirname(p: string): string;
  function basename(p: string): string;
}

declare module "https" {
  interface RequestOptions {
    headers?: Record<string, string>;
  }
  interface IncomingMessage {
    statusCode?: number;
    headers: Record<string, string>;
    on(event: "data", listener: (chunk: string) => void): IncomingMessage;
    on(event: "end", listener: () => void): IncomingMessage;
  }
  interface ClientRequest {
    on(event: "error", listener: (err: Error) => void): ClientRequest;
    setTimeout(ms: number, listener: () => void): ClientRequest;
    destroy(): void;
  }
  function get(
    url: string,
    options: RequestOptions,
    callback: (res: IncomingMessage) => void
  ): ClientRequest;
}

// NodeTimer is returned by setInterval — has .unref() to not block process exit
interface NodeTimer {
  unref(): this;
  ref(): this;
}

declare function setInterval(callback: () => void, ms: number): NodeTimer;
declare function clearInterval(id: NodeTimer | number | undefined): void;
declare function setTimeout(callback: () => void, ms: number): NodeTimer;
declare function clearTimeout(id: NodeTimer | number | undefined): void;
