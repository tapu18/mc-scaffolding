#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { buildProject } from "./build.js";
import { loadConfig } from "./config.js";
import { runDev } from "./dev.js";
import { CliError } from "./errors.js";
import { initProject } from "./init.js";
import { syncPack } from "./sync.js";
import {
  clearDefaultMinecraftPath,
  loadUserConfig,
  setDefaultMinecraftPath,
  getUserConfigPath,
} from "./user-config.js";
import type { MinecraftEdition } from "./types.js";

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

const configCommand = program.command("config").description("Manage user defaults.");

configCommand
  .command("show")
  .description("Show user configuration.")
  .action(async () => {
    const config = await loadUserConfig();
    console.log(JSON.stringify({ path: getUserConfigPath(), config }, null, 2));
  });

configCommand
  .command("set-path")
  .description("Set the default development_behavior_packs path.")
  .requiredOption("--edition <edition>", "Minecraft edition: bedrock or preview")
  .requiredOption("--path <path>", "development_behavior_packs path")
  .action(async (options: { edition: string; path: string }) => {
    const edition = parseEdition(options.edition);
    const configPath = await setDefaultMinecraftPath(edition, path.resolve(options.path));
    console.log(`Saved ${edition} path to ${configPath}`);
  });

configCommand
  .command("clear-path")
  .description("Clear the default development_behavior_packs path.")
  .requiredOption("--edition <edition>", "Minecraft edition: bedrock or preview")
  .action(async (options: { edition: string }) => {
    const edition = parseEdition(options.edition);
    const configPath = await clearDefaultMinecraftPath(edition);
    console.log(`Cleared ${edition} path in ${configPath}`);
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

function parseEdition(value: string): MinecraftEdition {
  if (value === "bedrock" || value === "preview") {
    return value;
  }
  throw new CliError("Edition must be either bedrock or preview.");
}
