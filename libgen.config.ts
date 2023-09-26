import { fileURLToPath, resolve } from "node:url";
import { defineConfig } from "./src/index";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  entryDir: resolve(__dirname, "./src"),
  outDir: resolve(__dirname, "./dir"),
});
