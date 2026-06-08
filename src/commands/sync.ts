import type { Command } from "commander";
import { loadConfig } from "../core/config.js";
import { syncPack } from "../core/sync.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync the current dist output to Minecraft without rebuilding.")
    .option("--force", "allow sync to take ownership of an existing target")
    .option("--dry-run", "show sync actions without writing to Minecraft")
    .action(async (options: { force?: boolean; dryRun?: boolean }) => {
      const projectDir = process.cwd();
      const config = await loadConfig(projectDir);
      const result = await syncPack(projectDir, config, {
        force: options.force,
        dryRun: options.dryRun,
      });
      console.log(`${result.dryRun ? "Would sync" : "Synced"} ${result.targetDir}`);
      for (const action of result.actions) {
        console.log(`  ${action}`);
      }
    });
}
