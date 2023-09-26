import { program } from "commander";
import { version, description } from "../package.json";
import { build } from "./command/build";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const read = () => {
  program.name("lib-gen-cli").description(description).version(version);

  program
    .command("build")
    .description("构建命令")
    .option("-c,--configPath <string>", "cook.config.json配置文件路径")
    .action((options) => {
      let { configPath = "" } = options;
      if (!configPath) {
        configPath = resolve(__dirname, "./libgen.config.ts");
      }
      const _config = require(configPath);
      build(_config);
    });

  program.parse();
};
