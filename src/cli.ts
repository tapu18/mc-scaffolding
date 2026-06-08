#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerBuildCommand } from "./commands/build.js";
import { registerDevCommand } from "./commands/dev.js";
import { registerInitCommand } from "./commands/init.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerUserConfigCommand } from "./commands/user-config.js";
import { CliError } from "./shared/errors.js";
import { getPackageVersion } from "./shared/package-info.js";

const version = getPackageVersion();

export function createProgram(): Command {
  const program = new Command();

  program
    .name("mc-scaffolding")
    .description("Minecraft Bedrock Script API addon scaffolding CLI.")
    .version(version);

  program
    .command("version")
    .description("Show the mc-scaffolding version.")
    .action(() => {
      console.log(version);
    });

  registerInitCommand(program);
  registerBuildCommand(program);
  registerSyncCommand(program);
  registerDevCommand(program);
  registerUserConfigCommand(program);

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (isDirectRun()) {
  runCli().catch(handleCliError);
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

function handleCliError(error: unknown): void {
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
}
