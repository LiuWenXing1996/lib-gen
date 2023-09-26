import { program } from "commander";
import { version, description } from "../package.json";
import { build } from "./command/build";
import { resolve } from "node:path";
import { loadConfigFromFile } from "./utils/resolveConfig";

export const read = () => {
  program.name("lib-gen-cli").description(description).version(version);

  program
    .command("build")
    .description("构建命令")
    .option("-c,--configPath <string>", "cook.config.json配置文件路径")
    .action(async (options) => {
      let { configPath = "" } = options;
      if (!configPath) {
        configPath = resolve(process.cwd(), "./libgen.config.ts");
      }
      const { config } = await loadConfigFromFile(configPath);
      console.log("config", config)
      build(config);
    });

  program.parse();
};
