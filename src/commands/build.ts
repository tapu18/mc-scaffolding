import path from "node:path";
import type { Command } from "commander";
import { buildProject } from "../core/build.js";
import { loadConfig } from "../core/config.js";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Build the addon and sync it to Minecraft by default.")
    .option("--no-sync", "build without syncing to Minecraft")
    .action(async (options: { sync: boolean }) => {
      const projectDir = process.cwd();
      const config = await loadConfig(projectDir);
      const result = await buildProject(projectDir, config, { sync: options.sync });
      console.log(`Built ${path.relative(projectDir, result.distDir)}`);
      if (result.syncedTo) {
        console.log(`Synced ${result.syncedTo}`);
      }
    });
}
