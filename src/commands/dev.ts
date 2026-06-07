import type { Command } from "commander";
import { runDev } from "../core/dev.js";

export function registerDevCommand(program: Command): void {
  program
    .command("dev")
    .description("Build, sync, and watch for changes.")
    .action(async () => {
      await runDev(process.cwd());
    });
}
