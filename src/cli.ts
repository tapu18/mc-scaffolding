#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { buildProject } from "./build.js";
import { loadConfig } from "./config.js";
import { runDev } from "./dev.js";
import { CliError } from "./errors.js";
import { initProject } from "./init.js";
import { syncPack } from "./sync.js";

const program = new Command();

program.name("mc-scaffolding").description("Minecraft Bedrock Script API addon scaffolding CLI.");

program
  .command("init")
  .description("Create a new Script API addon project in the current directory.")
  .action(async () => {
    await initProject(process.cwd());
    console.log("Initialized mc-scaffolding project.");
  });

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

program
  .command("sync")
  .description("Sync the current dist output to Minecraft without rebuilding.")
  .action(async () => {
    const projectDir = process.cwd();
    const config = await loadConfig(projectDir);
    const targetDir = await syncPack(projectDir, config);
    console.log(`Synced ${targetDir}`);
  });

program
  .command("dev")
  .description("Build, sync, and watch for changes.")
  .action(async () => {
    await runDev(process.cwd());
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
    return;
  }

  console.error(String(error));
  process.exitCode = 1;
});
