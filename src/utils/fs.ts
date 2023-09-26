import { Volume, createFsFromVolume, type IFs } from 'memfs'
import type { vol } from 'memfs'
import type * as _FsPromisesApi from "node:fs/promises"
import { dirname, join } from 'node:path'

export type IFsPromisesApi = typeof _FsPromisesApi
export const listFiles = async (fs: IFsPromisesApi, dir?: string) => {
  const files: string[] = [];
  dir = dir || '/'
  const getFiles = async (currentDir: string) => {
    const fileList = await fs.readdir(currentDir) as string[];
    for (const file of fileList) {
      const name = join(currentDir, file);
      if ((await fs.stat(name)).isDirectory()) {
        await getFiles(name);
      } else {
        files.push(name);
      }
    }
  }
  return files;
}

export const exists = async (fs: IFsPromisesApi, path: string) => {
  const { stat } = fs
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export type IWriteFileData = Parameters<IFsPromisesApi["writeFile"]>[1]
export type IWriteFileOptions = Parameters<IFsPromisesApi["writeFile"]>[2]
export const outputFile = async (fs: IFsPromisesApi, path: string, data: IWriteFileData, options?: IWriteFileOptions) => {
  const dir = dirname(path)
  const { mkdir, writeFile } = fs
  const isExists = exists(fs, dir)
  if (!isExists) {
    mkdir(dir)
  }
  writeFile(path, data, options)
}

export const copyFromFs = async (fromFs: IFsPromisesApi, toFs: IFsPromisesApi, dir: string) => {
  const fromFiles = await listFiles(fromFs, dir)
  await Promise.all(fromFiles.map(async fromFile => {
    const data = await fromFs.readFile(fromFile)
    await outputFile(toFs, fromFile, data)
  }))
}

export const createVfs = (): IVirtulFileSystem => {
  const vol = new Volume()
  const fs = createFsFromVolume(vol)
  const fsPromises = fs.promises as unknown as IFsPromisesApi

  const readJson = async<T>(path: string): Promise<T> => {
    let jsonObj: T | undefined = undefined
    const content = await fsPromises.readFile(path, 'utf-8') as string
    jsonObj = JSON.parse(content || '') as T
    return jsonObj
  }

  const _listFiles = async (dir?: string) => {
    return await listFiles(fsPromises, dir)
  }

  const _exists = async (path: string) => {
    return await exists(fsPromises, path)
  }

  const vfs: IVirtulFileSystem = {
    ...fsPromises,
    readJson,
    listFiles: _listFiles,
    exists: _exists,
    getFs: () => {
      return fs
    },
    getVoulme: () => {
      return vol
    }
  }

  return vfs
}

export interface IVirtulFileSystem extends IFsPromisesApi {
  readJson: <T>(path: string) => Promise<T>,
  listFiles: (dir?: string) => Promise<string[]>,
  exists: (path: string) => Promise<boolean>,
  getFs: () => IFs,
  getVoulme: () => typeof vol
}
