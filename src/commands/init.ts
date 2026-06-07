import type { Command } from "commander";
import { initProject } from "../init/index.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a new Script API addon project in the current directory.")
    .action(async () => {
      await initProject(process.cwd());
      console.log("Initialized mc-scaffolding project.");
    });
}
