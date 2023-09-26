/**
 * modified based on https://github.com/vitejs/vite/blob/ca34c64b1dc6e898495d655f89c300dd14758121/packages/vite/src/node/config.ts
 */

// TODO:基于vite的config实现一个config加载器
// TODO:测试是否可用

import fs from "node:fs";
import path, { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import colors from "picocolors";
import { build } from "esbuild";

import { readJson } from "fs-extra";
import { IBuildConfig } from "..";
import { dynamicImport, isObject, normalizePath } from ".";

const debug = (msg: string) => {
  // TODO:实现debug console
};

export const DEFAULT_CONFIG_FILES = [
  "libgen.config.js",
  "libgen.config.mjs",
  "libgen.config.ts",
  "libgen.config.cjs",
  "libgen.config.mts",
  "libgen.config.cts",
];

export async function loadConfigFromFile(
  configFile: string,
  configRoot: string = process.cwd()
): Promise<{
  path: string;
  config: IBuildConfig;
  dependencies: string[];
} | null> {
  const start = performance.now();
  const getTime = () => `${(performance.now() - start).toFixed(2)}ms`;

  let resolvedPath: string | undefined;

  if (configFile) {
    // explicit config path is always resolved from cwd
    resolvedPath = path.resolve(configFile);
  } else {
    // implicit config file loaded from inline root (if present)
    // otherwise from cwd
    for (const filename of DEFAULT_CONFIG_FILES) {
      const filePath = path.resolve(configRoot, filename);
      if (!fs.existsSync(filePath)) continue;

      resolvedPath = filePath;
      break;
    }
  }

  if (!resolvedPath) {
    debug("no config file found.");
    return null;
  }

  let isESM = false;
  if (/\.m[jt]s$/.test(resolvedPath)) {
    isESM = true;
  } else if (/\.c[jt]s$/.test(resolvedPath)) {
    isESM = false;
  } else {
    // check package.json for type: "module" and set `isESM` to true
    try {
      const pkg = await readJson(resolve(configRoot, "package.json"));
      isESM = !!pkg && pkg.type === "module";
    } catch (e) {}
  }

  try {
    const bundled = await bundleConfigFile(resolvedPath, isESM);
    const config = await loadConfigFromBundledFile(
      resolvedPath,
      bundled.code,
      isESM
    );
    debug(`bundled config file loaded in ${getTime()}`);

    if (!isObject(config)) {
      throw new Error(`config must export or return an object.`);
    }
    return {
      path: normalizePath(resolvedPath),
      config,
      dependencies: bundled.dependencies,
    };
  } catch (e) {
    console.error(colors.red(`failed to load config from ${resolvedPath}`), {
      error: e,
    });
    throw e;
  }
}

async function bundleConfigFile(
  fileName: string,
  isESM: boolean
): Promise<{ code: string; dependencies: string[] }> {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [fileName],
    outfile: "out.js",
    write: false,
    target: ["node14.18", "node16"],
    platform: "node",
    bundle: true,
    format: isESM ? "esm" : "cjs",
    mainFields: ["main"],
    sourcemap: "inline",
    metafile: true,
  });
  const { text } = result.outputFiles[0];
  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  };
}

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any;
}

const _require = createRequire(import.meta.url);
async function loadConfigFromBundledFile(
  fileName: string,
  bundledCode: string,
  isESM: boolean
): Promise<IBuildConfig> {
  // for esm, before we can register loaders without requiring users to run node
  // with --experimental-loader themselves, we have to do a hack here:
  // write it to disk, load it with native Node ESM, then delete the file.
  if (isESM) {
    const fileBase = `${fileName}.timestamp-${Date.now()}`;
    const fileNameTmp = `${fileBase}.mjs`;
    const fileUrl = `${pathToFileURL(fileBase)}.mjs`;
    fs.writeFileSync(fileNameTmp, bundledCode);
    try {
      return (await dynamicImport(fileUrl)).default;
    } finally {
      try {
        fs.unlinkSync(fileNameTmp);
      } catch {
        // already removed if this function is called twice simultaneously
      }
    }
  }
  // for cjs, we can register a custom loader via `_require.extensions`
  else {
    const extension = path.extname(fileName);
    const realFileName = fs.realpathSync(fileName);
    const loaderExt = extension in _require.extensions ? extension : ".js";
    const defaultLoader = _require.extensions[loaderExt]!;
    _require.extensions[loaderExt] = (module: NodeModule, filename: string) => {
      if (filename === realFileName) {
        (module as NodeModuleWithCompile)._compile(bundledCode, filename);
      } else {
        defaultLoader(module, filename);
      }
    };
    // clear cache in case of server restart
    delete _require.cache[_require.resolve(fileName)];
    const raw = _require(fileName);
    _require.extensions[loaderExt] = defaultLoader;
    return raw.__esModule ? raw.default : raw;
  }
}