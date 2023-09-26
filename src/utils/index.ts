import path, { extname } from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

export const trimExtname = (path: string, extnames?: string[]) => {
  let willTrim = true;
  const _extname = extname(path);
  if (extnames) {
    willTrim = extnames.includes(_extname);
  }
  if (willTrim && _extname) {
    return path.slice(0, path.length - _extname.length);
  } else {
    return path;
  }
};

export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function slash(p: string): string {
  return p.replace(/\\/g, "/");
}

export const isWindows = os.platform() === "win32";

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id);
}

// TODO: use import()
const _require = createRequire(import.meta.url);

// @ts-expect-error jest only exists when running Jest
export const usingDynamicImport = typeof jest === "undefined";

/**
 * Dynamically import files. It will make sure it's not being compiled away by TS/Rollup.
 *
 * As a temporary workaround for Jest's lack of stable ESM support, we fallback to require
 * if we're in a Jest environment.
 * See https://github.com/vitejs/vite/pull/5197#issuecomment-938054077
 *
 * @param file File path to import.
 */
export const dynamicImport = usingDynamicImport
  ? new Function("file", "return import(file)")
  : _require;


export * from "./fs";
