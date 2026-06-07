import path from "node:path";
import type { Command } from "commander";
import { CliError } from "../shared/errors.js";
import type { MinecraftEdition } from "../shared/types.js";
import {
  clearDefaultMinecraftPath,
  getUserConfigPath,
  loadUserConfig,
  setDefaultMinecraftPath,
} from "../user/config.js";

export function registerUserConfigCommand(program: Command): void {
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
}

function parseEdition(value: string): MinecraftEdition {
  if (value === "bedrock" || value === "preview") {
    return value;
  }
  throw new CliError("Edition must be either bedrock or preview.");
}
