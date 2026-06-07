import type { Command } from "commander";
import { loadConfig } from "../core/config.js";
import { syncPack } from "../core/sync.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync the current dist output to Minecraft without rebuilding.")
    .action(async () => {
      const projectDir = process.cwd();
      const config = await loadConfig(projectDir);
      const targetDir = await syncPack(projectDir, config);
      console.log(`Synced ${targetDir}`);
    });
}
