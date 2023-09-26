import * as esbuild from "esbuild";
import { copyFromFs, createVfs, listFiles as listFilesS, outputFile } from "../utils/fs";
import type * as _IPath from "node:path";
import type { Loader, TransformOptions } from "esbuild";
import { transformVueFile } from "../utils/vueTransform";
import * as nodeFs from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";

export type IPath = typeof _IPath;

export const genSameNameFile = (fileName: string, newExtName: string) => {
  const baseName = basename(fileName);
  return resolve(fileName, "../", `${baseName}${newExtName}`);
};

export interface IBuildConfig {
  entryDir: string;
  outDir: string;
  sourcemap?: boolean;
  esbuildTransfromOptions?: Omit<TransformOptions, "loader" | "sourcemap">;
  esbuildLoaders?: Record<string, Loader>;
  outExtnames?: Record<string, string>;
}

export const getEsbuildLoader = (extName: string): Loader => {
  const loaderMap: Record<string, Loader> = {
    ".js": "js",
    ".cjs": "js",
    ".mjs": "js",
    ".ts": "ts",
    ".mts": "ts",
    ".cts": "ts",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".json": "binary",
    ".css": "css",
    ".txt": "binary",
  };
  return loaderMap[extName] || "binary";
};
export const getOutExtname = (extName: string): string => {
  const loaderMap: Record<string, string> = {
    ".js": ".js",
    ".cjs": ".js",
    ".mjs": ".js",
    ".ts": ".js",
    ".mts": ".js",
    ".cts": ".js",
    ".jsx": ".js",
    ".tsx": ".js",
    ".json": ".json",
    ".css": ".css",
  };
  return loaderMap[extName] || extName;
};

export const transformVueScript = async (
  content: string,
  config: {
    sourcemap?: boolean;
    filePath: string;
  }
) => {
  const { sourcemap, filePath } = config;
  const res = await transformVueFile(content, { filename: filePath });
  if (res) {
  }
};

export const defineConfig = (config: IBuildConfig) => {
  return config;
};

export const build = async (options: IBuildConfig) => {
  // TODO:outDir是否位于项目外检测
  const {
    entryDir,
    outDir,
    esbuildTransfromOptions,
    esbuildLoaders = {},
    outExtnames = {},
  } = options;
  const vfs = createVfs();
  await copyFromFs(nodeFs, vfs, entryDir);
  const { listFiles, readFile, writeFile } = vfs;
  const vueFiles = (await listFiles(entryDir)).filter(
    (e) => extname(e) === ".vue"
  );

  // process .vue file
  await Promise.all(
    vueFiles.map(async (vueFile) => {
      const content = await readFile(vueFile, "utf-8");
      const res = await transformVueFile(content, { filename: vueFile });
      if (!res) {
        return;
      }
      const outputFiles = [res.script, ...res.styles];
      await Promise.all(
        outputFiles.map(async (outputFile) => {
          await writeFile(outputFile.filename, outputFile.content);
        })
      );
    })
  );

  const allFiles = await listFiles(entryDir);
  const outputFiles = await Promise.all(
    allFiles.map(async (file) => {
      const content = await readFile(file);
      const extName = extname(file);
      const baseName = basename(file, extName);
      const loader = esbuildLoaders[extName] || getEsbuildLoader(extName);
      const result = await esbuild.transform(content, {
        ...esbuildTransfromOptions,
        loader: loader,
      });
      const outExtname = outExtnames[extName] || getOutExtname(extName);
      const relativePath = relative(entryDir, file)
      const outfile = resolve(outDir, relativePath, "../", `${baseName}${outExtname}`);
      await outputFile(vfs, outfile, result.code)
      return {
        fileName: outfile,
        content: result.code,
      };
    })
  );

  console.log(outputFiles.map((e) => e.fileName));
  await copyFromFs(vfs, nodeFs, outDir)
  return outputFiles;
};
