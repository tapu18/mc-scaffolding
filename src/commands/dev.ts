import type { Command } from "commander";
import { runDev } from "../core/dev.js";

export function registerDevCommand(program: Command): void {
  program
    .command("dev")
    .description("Build, sync, and watch for changes.")
    .option("--force", "allow sync to take ownership of an existing target")
    .action(async (options: { force?: boolean }) => {
      await runDev(process.cwd(), { force: options.force });
    });
}
