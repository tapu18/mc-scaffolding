import type { Command } from "commander";
import { initProject } from "../init/index.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a new Script API addon project in the current directory.")
    .option("--no-install", "skip npm install after generating files")
    .action(async (options: { install?: boolean }) => {
      await initProject(process.cwd(), { install: options.install !== false });
      console.log("Initialized mc-scaffolding project.");
    });
}
