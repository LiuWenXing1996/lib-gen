import { resolve } from "node:path";
import { defineConfig } from "./src/utils/defineConfig"


// TODO:支持多配置
export default defineConfig({
  entryDir: resolve(__dirname, "./src"),
  outDir: resolve(__dirname, "./dist"),
  esbuildTransfromOptions: {
    format: "cjs"
  }
});
