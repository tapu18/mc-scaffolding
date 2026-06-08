import path from "node:path";
import type { Command } from "commander";
import { buildProject } from "../core/build.js";
import { loadConfig } from "../core/config.js";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Build the addon.")
    .option("--sync", "sync to Minecraft after building")
    .option("--force", "allow sync to take ownership of an existing target")
    .option("--dry-run", "show sync actions without writing to Minecraft")
    .action(async (options: { sync?: boolean; force?: boolean; dryRun?: boolean }) => {
      const projectDir = process.cwd();
      const config = await loadConfig(projectDir);
      const shouldSync = options.sync === true || options.dryRun === true;
      const result = await buildProject(projectDir, config, {
        sync: shouldSync,
        syncOptions: { force: options.force, dryRun: options.dryRun },
      });
      console.log(`Built ${path.relative(projectDir, result.distDir)}`);
      if (result.syncedTo) {
        console.log(`${options.dryRun ? "Would sync" : "Synced"} ${result.syncedTo}`);
        for (const action of result.syncResult?.actions ?? []) {
          console.log(`  ${action}`);
        }
      }
    });
}
